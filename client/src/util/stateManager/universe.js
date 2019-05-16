// jshint esversion: 6

import _ from "lodash";

import decodeMatrixFBS from "./matrix";
import * as Dataframe from "../dataframe";
import fromEntries from "../fromEntries";
import { isFpTypedArray } from "../typeHelpers";

/*
Private helper function - create and return a template Universe
*/
function templateUniverse() {
  /* default universe template */
  return {
    nObs: 0,
    nVar: 0,
    schema: {},

    /*
    Annotations
    */
    obsAnnotations: Dataframe.Dataframe.empty(),
    varAnnotations: Dataframe.Dataframe.empty(),
    obsLayout: Dataframe.Dataframe.empty(),

    /*
    Var data columns - subset of all
    */
    varData: Dataframe.Dataframe.empty(null, new Dataframe.KeyIndex())
  };
}

/*
This module implements functions that support storage of "Universe",
aka all of the var/obs data and annotations.

These functions are used exclusively by the actions and reducers to
build an internal POJO for use by the rendering components.
*/

function promoteTypedArray(o) {
  /*
  Decide what internal data type to use for the data returned from 
  the server.

  TODO - future optimization: not all int32/uint32 data series require
  promotion to float64.  We COULD simply look at the data to decide. 
  */
  if (isFpTypedArray(o) || Array.isArray(o)) return o;

  let TyepdArrayCtor;
  switch (o.constructor) {
    case Int8Array:
    case Uint8Array:
    case Uint8ClampedArray:
    case Int16Array:
    case Uint16Array:
      TyepdArrayCtor = Float32Array;
      break;

    case Int32Array:
    case Uint32Array:
      TyepdArrayCtor = Float64Array;
      break;

    default:
      throw new Error("Unexpected data type returned from server.");
  }
  if (o.constructor === TyepdArrayCtor) return o;
  return new TyepdArrayCtor(o);
}

function AnnotationsFBSToDataframe(arrayBuffer) {
  /*
  Convert a Matrix FBS to a Dataframe.

  The application has strong assumptions that all scalar data will be
  stored as a float32 or float64 (regardless of underlying data types).
  For example, clipping of value ranges (eg, user-selected percentiles)
  depends on the ability to use NaN in any numeric type.

  All float data from the server is left as is.  All non-float is promoted
  to an appropriate float.
  */
  const fbs = decodeMatrixFBS(arrayBuffer, true); // leave in place
  const columns = fbs.columns.map(c => {
    if (isFpTypedArray(c) || Array.isArray(c)) return c;
    return promoteTypedArray(c);
  });
  const df = new Dataframe.Dataframe(
    [fbs.nRows, fbs.nCols],
    columns,
    null,
    new Dataframe.KeyIndex(fbs.colIdx)
  );
  return df;
}

function LayoutFBSToDataframe(arrayBuffer) {
  const fbs = decodeMatrixFBS(arrayBuffer, true);
  if (fbs.columns.length < 2 || !fbs.columns.every(isFpTypedArray)) {
    // We have strong assumptions about the shape & type of layout data.
    throw new Error("Unexpected layout data type returned from server");
  }

  /*
  TODO: XXX

  TEMPORARY CODE AND COMMENT to support the progressive implementation
  of multi-layout support.  For now, we search for one of the following 
  in the layouts and use it if we find it: umap, then tsne, then pca, 
  then whatever is first in the list.
  */
  let layoutIndex = 0;
  ["umap", "tsne", "pca"].some(name => {
    const idx = fbs.colIdx.indexOf(`${name}_0`);
    if (idx !== -1) {
      layoutIndex = idx;
    }
    return idx !== -1;
  });
  const df = new Dataframe.Dataframe(
    [fbs.nRows, 2],
    [fbs.columns[layoutIndex], fbs.columns[layoutIndex + 1]],
    null,
    new Dataframe.KeyIndex(["X", "Y"])
  );
  return df;
}

function reconcileSchemaCategoriesWithSummary(universe) {
  /*
  where we treat types as (essentially) categorical metadata, update
  the schema with data-derived categories (in addition to those in
  the server declared schema).

  For example, boolean defined fields in the schema do not contain
  explicit declaration of categories (nor do string fields).  In these
  cases, add a 'categories' field to the schema so it is accessible.
  */

  universe.schema.annotations.obs.forEach(s => {
    if (
      s.type === "string" ||
      s.type === "boolean" ||
      s.type === "categorical"
    ) {
      const categories = _.union(
        s.categories ?? [],
        universe.obsAnnotations.col(s.name).summarize().categories ?? []
      );
      s.categories = categories;
    }
  });
}

export function createUniverseFromResponse(
  configResponse,
  schemaResponse,
  annotationsObsResponse,
  annotationsVarResponse,
  layoutFBSResponse
) {
  /*
  build & return universe from a REST 0.2 /config, /schema and /annotations/obs response
  */
  const { schema } = schemaResponse;
  const universe = templateUniverse();

  /* schema related */
  universe.schema = schema;
  universe.nObs = schema.dataframe.nObs;
  universe.nVar = schema.dataframe.nVar;

  /* annotations */
  universe.obsAnnotations = AnnotationsFBSToDataframe(annotationsObsResponse);
  universe.varAnnotations = AnnotationsFBSToDataframe(annotationsVarResponse);
  /* layout */
  universe.obsLayout = LayoutFBSToDataframe(layoutFBSResponse);

  /* sanity check */
  if (
    universe.nObs !== universe.obsLayout.length ||
    universe.nObs !== universe.obsAnnotations.length ||
    universe.nVar !== universe.varAnnotations.length
  ) {
    throw new Error("Universe dimensionality mismatch - failed to load");
  }

  reconcileSchemaCategoriesWithSummary(universe);

  /* Index schema for ease of use */
  universe.schema.annotations.obsByName = fromEntries(
    universe.schema.annotations.obs.map(v => [v.name, v])
  );
  universe.schema.annotations.varByName = fromEntries(
    universe.schema.annotations.var.map(v => [v.name, v])
  );
  return universe;
}

export function convertDataFBStoObject(universe, arrayBuffer) {
  /*
  /data/var returns a flatbuffer (FBS) as described by cellxgene/fbs/matrix.fbs

  This routine converts the binary wire encoding into a JS object:

  {
    gene: Float32Array,
    ...
  }
  */
  const fbs = decodeMatrixFBS(arrayBuffer);
  const { colIdx, columns } = fbs;
  const result = {};

  if (!columns.every(isFpTypedArray)) {
    // We have strong assumptions that all var data is float
    throw new Error("Unexpected non-floating point response from server.");
  }

  for (let c = 0; c < colIdx.length; c += 1) {
    const varName = universe.varAnnotations.at(colIdx[c], "name");
    result[varName] = columns[c];
  }
  return result;
}
