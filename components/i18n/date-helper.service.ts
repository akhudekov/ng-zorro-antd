/**
 * @license
 * Copyright Alibaba.com All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/NG-ZORRO/ng-zorro-antd/blob/master/LICENSE
 */

import { formatDate } from '@angular/common';
import { Inject, Injectable, Injector, Optional } from '@angular/core';
import fnsFormat from 'date-fns/format';
import fnsGetISOWeek from 'date-fns/get_iso_week';
import fnsParse from 'date-fns/parse';

import { mergeDateConfig, NZ_DATE_CONFIG, NzDateConfig } from './date-config';
import { NzI18nService } from './nz-i18n.service';

export function DATE_HELPER_SERVICE_FACTORY(injector: Injector, config: NzDateConfig): DateHelperService {
  const i18n = injector.get(NzI18nService);
  return i18n.getDateLocale() ? new DateHelperByDateFns(i18n, config) : new DateHelperByDatePipe(i18n, config);
}

/**
 * Abstract DateHelperService(Token via Class)
 * Compatibility: compact for original usage by default which using DatePipe
 */
@Injectable({
  providedIn: 'root',
  useFactory: DATE_HELPER_SERVICE_FACTORY,
  deps: [Injector, [new Optional(), NZ_DATE_CONFIG]]
})
export abstract class DateHelperService {
  relyOnDatePipe: boolean = this instanceof DateHelperByDatePipe; // Indicate whether this service is rely on DatePipe

  constructor(protected i18n: NzI18nService, @Optional() @Inject(NZ_DATE_CONFIG) protected config: NzDateConfig) {
    this.config = mergeDateConfig(this.config);
  }

  abstract getISOWeek(date: Date): number;
  abstract getFirstDayOfWeek(): WeekDayIndex;
  abstract format(date: Date, formatStr: string): string;

  parseDate(text: string, format: string): Date | undefined {
    if (!text) {
      return;
    }
    if (!format) {
      return fnsParse(text);
    }
    if (text.length !== format.length) {
      return;
    }
    let date: number | undefined;
    let hours: number | undefined;
    let minutes: number | undefined;
    let seconds: number | undefined;
    let ms: number | undefined;
    let si = format.indexOf('y');
    let fi = format.lastIndexOf('y');
    const year = Number(text.substr(si, fi - si + 1));
    si = format.indexOf('M');
    fi = format.lastIndexOf('M');
    const month = Number(text.substr(si, fi - si + 1)) - 1;
    const parsedDate = new Date(year, month);
    if (format.indexOf('dd') > -1) {
      si = format.indexOf('d');
      fi = format.lastIndexOf('d');
      date = Number(text.substr(si, fi - si + 1));
      parsedDate.setDate(date);
    }
    if (format.indexOf('HH') > -1) {
      si = format.indexOf('H');
      fi = format.lastIndexOf('H');
      hours = Number(text.substr(si, fi - si + 1));
      parsedDate.setHours(hours);
    }
    if (format.indexOf('hh') > -1) {
      si = format.indexOf('h');
      fi = format.lastIndexOf('h');
      hours = Number(text.substr(si, fi - si + 1));
      parsedDate.setHours(hours);
    }
    if (format.indexOf('mm') > -1) {
      si = format.indexOf('m');
      fi = format.lastIndexOf('m');
      minutes = Number(text.substr(si, fi - si + 1));
      parsedDate.setMinutes(minutes);
    }
    if (format.indexOf('ss') > -1) {
      si = format.indexOf('s');
      fi = format.lastIndexOf('s');
      seconds = Number(text.substr(si, fi - si + 1));
      parsedDate.setSeconds(seconds);
    }
    if (format.indexOf('fff') > -1) {
      si = format.indexOf('f');
      fi = format.lastIndexOf('f');
      ms = Number(text.substr(si, fi - si + 1));
      parsedDate.setMilliseconds(ms);
    }
    return parsedDate;
  }

  parseTime(text: string): Date | undefined {
    if (!text) {
      return;
    }
    return fnsParse(`1970-01-01 ${text}`);
  }
}

/**
 * DateHelper that handles date formats with date-fns
 */
export class DateHelperByDateFns extends DateHelperService {
  getISOWeek(date: Date): number {
    return fnsGetISOWeek(date);
  }

  // TODO: Use date-fns's "weekStartsOn" to support different locale when "config.firstDayOfWeek" is null
  // when v2.0 is ready: https://github.com/date-fns/date-fns/blob/v2.0.0-alpha.27/src/locale/en-US/index.js#L23
  getFirstDayOfWeek(): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
    return this.config.firstDayOfWeek == null ? 1 : this.config.firstDayOfWeek;
  }

  /**
   * Format a date
   * @see https://date-fns.org/docs/format#description
   * @param date Date
   * @param formatStr format string
   */
  format(date: Date | null, formatStr: string): string {
    return date ? fnsFormat(date, formatStr, { locale: this.i18n.getDateLocale() }) : '';
  }
}

/**
 * DateHelper that handles date formats with angular's date-pipe
 *
 * @see https://github.com/NG-ZORRO/ng-zorro-antd/issues/2406 - DatePipe may cause non-standard week bug, see:
 *
 */
export class DateHelperByDatePipe extends DateHelperService {
  constructor(i18n: NzI18nService, @Optional() @Inject(NZ_DATE_CONFIG) config: NzDateConfig) {
    super(i18n, config);
  }

  getISOWeek(date: Date): number {
    return +this.format(date, 'w');
  }

  getFirstDayOfWeek(): WeekDayIndex {
    if (this.config.firstDayOfWeek === undefined) {
      const locale = this.i18n.getLocaleId();
      return locale && ['zh-cn', 'zh-tw'].indexOf(locale.toLowerCase()) > -1 ? 1 : 0;
    }
    return this.config.firstDayOfWeek;
  }

  format(date: Date | null, formatStr: string): string {
    return date ? formatDate(date, formatStr, this.i18n.getLocaleId())! : '';
  }

  /**
   * Compatible translate the moment-like format pattern to angular's pattern
   * Why? For now, we need to support the existing language formats in AntD, and AntD uses the default temporal syntax.
   *
   * TODO: compare and complete all format patterns
   * Each format docs as below:
   * @link https://momentjs.com/docs/#/displaying/format/
   * @link https://angular.io/api/common/DatePipe#description
   * @param format input format pattern
   */
  transCompatFormat(format: string): string {
    return (
      format &&
      format
        .replace(/Y/g, 'y') // only support y, yy, yyy, yyyy
        .replace(/D/g, 'd')
    ); // d, dd represent of D, DD for momentjs, others are not support
  }
}

////////////

export type WeekDayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;
