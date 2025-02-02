/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import rison, { RisonValue } from 'rison-node';
import {
  buildQueryFilter,
  PhraseFilter,
  ExistsFilter,
  buildPhraseFilter as esBuildPhraseFilter,
  buildPhrasesFilter as esBuildPhrasesFilter,
  buildExistsFilter as esBuildExistsFilter,
} from '@kbn/es-query';
import type { ReportViewType, SeriesUrl, UrlFilter } from '../types';
import type { AllSeries, AllShortSeries } from '../hooks/use_series_storage';
import { IndexPattern } from '../../../../../../../../src/plugins/data/common';
import { URL_KEYS } from './constants/url_constants';
import { PersistableFilter } from '../../../../../../lens/common';

export function convertToShortUrl(series: SeriesUrl) {
  const {
    operationType,
    seriesType,
    breakdown,
    filters,
    reportDefinitions,
    dataType,
    selectedMetricField,
    hidden,
    name,
    color,
    ...restSeries
  } = series;

  return {
    [URL_KEYS.OPERATION_TYPE]: operationType,
    [URL_KEYS.SERIES_TYPE]: seriesType,
    [URL_KEYS.BREAK_DOWN]: breakdown,
    [URL_KEYS.FILTERS]: filters,
    [URL_KEYS.REPORT_DEFINITIONS]: reportDefinitions,
    [URL_KEYS.DATA_TYPE]: dataType,
    [URL_KEYS.SELECTED_METRIC]: selectedMetricField,
    [URL_KEYS.HIDDEN]: hidden,
    [URL_KEYS.NAME]: name,
    [URL_KEYS.COLOR]: color,
    ...restSeries,
  };
}

export function createExploratoryViewRoutePath({
  reportType,
  allSeries,
}: {
  reportType: ReportViewType;
  allSeries: AllSeries;
}) {
  const allShortSeries: AllShortSeries = allSeries.map((series) => convertToShortUrl(series));

  return `/exploratory-view/#?reportType=${reportType}&sr=${rison.encode(
    allShortSeries as unknown as RisonValue
  )}`;
}

export function createExploratoryViewUrl(
  { reportType, allSeries }: { reportType: ReportViewType; allSeries: AllSeries },
  baseHref = '',
  appId = 'observability'
) {
  const allShortSeries: AllShortSeries = allSeries.map((series) => convertToShortUrl(series));

  return (
    baseHref +
    `/app/${appId}/exploratory-view/#?reportType=${reportType}&sr=${rison.encode(
      allShortSeries as unknown as RisonValue
    )}`
  );
}

export function buildPhraseFilter(field: string, value: string, indexPattern: IndexPattern) {
  const fieldMeta = indexPattern?.fields.find((fieldT) => fieldT.name === field);
  if (fieldMeta) {
    return [esBuildPhraseFilter(fieldMeta, value, indexPattern)];
  }
  return [];
}

export function getQueryFilter(field: string, value: string[], indexPattern: IndexPattern) {
  const fieldMeta = indexPattern?.fields.find((fieldT) => fieldT.name === field);
  if (fieldMeta && indexPattern.id) {
    return value.map((val) =>
      buildQueryFilter(
        {
          query_string: {
            fields: [field],
            query: `*${val}*`,
          },
        },
        indexPattern.id!,
        ''
      )
    );
  }

  return [];
}

export function buildPhrasesFilter(field: string, value: string[], indexPattern: IndexPattern) {
  const fieldMeta = indexPattern?.fields.find((fieldT) => fieldT.name === field);
  if (fieldMeta) {
    if (value.length === 1) {
      return [esBuildPhraseFilter(fieldMeta, value[0], indexPattern)];
    }
    return [esBuildPhrasesFilter(fieldMeta, value, indexPattern)];
  }
  return [];
}

export function buildExistsFilter(field: string, indexPattern: IndexPattern) {
  const fieldMeta = indexPattern?.fields.find((fieldT) => fieldT.name === field);
  if (fieldMeta) {
    return [esBuildExistsFilter(fieldMeta, indexPattern)];
  }
  return [];
}

type FiltersType = Array<PersistableFilter | ExistsFilter | PhraseFilter>;

export function urlFilterToPersistedFilter({
  urlFilters,
  initFilters,
  indexPattern,
}: {
  urlFilters: UrlFilter[];
  initFilters?: FiltersType;
  indexPattern: IndexPattern;
}) {
  const parsedFilters: FiltersType = initFilters ? [...initFilters] : [];

  urlFilters.forEach(
    ({ field, values = [], notValues = [], wildcards = [], notWildcards = ([] = []) }) => {
      if (values.length > 0) {
        const filter = buildPhrasesFilter(field, values, indexPattern);
        parsedFilters.push(...filter);
      }

      if (notValues.length > 0) {
        const filter = buildPhrasesFilter(field, notValues, indexPattern)[0];
        filter.meta.negate = true;
        parsedFilters.push(filter);
      }

      if (wildcards.length > 0) {
        const filter = getQueryFilter(field, wildcards, indexPattern);
        parsedFilters.push(...filter);
      }

      if (notWildcards.length > 0) {
        const filter = getQueryFilter(field, notWildcards, indexPattern)[0];
        filter.meta.negate = true;
        parsedFilters.push(filter);
      }
    }
  );

  return parsedFilters;
}
