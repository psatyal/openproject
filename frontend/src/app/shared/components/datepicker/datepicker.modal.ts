// -- copyright
// OpenProject is an open source project management software.
// Copyright (C) 2012-2022 the OpenProject GmbH
//
// This program is free software; you can redistribute it and/or
// modify it under the terms of the GNU General Public License version 3.
//
// OpenProject is a fork of ChiliProject, which is a fork of Redmine. The copyright follows:
// Copyright (C) 2006-2013 Jean-Philippe Lang
// Copyright (C) 2010-2013 the ChiliProject Team
//
// This program is free software; you can redistribute it and/or
// modify it under the terms of the GNU General Public License
// as published by the Free Software Foundation; either version 2
// of the License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program; if not, write to the Free Software
// Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
//
// See COPYRIGHT and LICENSE files for more details.
//++

import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Inject,
  Injector,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import { InjectField } from 'core-app/shared/helpers/angular/inject-field.decorator';
import { I18nService } from 'core-app/core/i18n/i18n.service';
import { OpModalComponent } from 'core-app/shared/components/modal/modal.component';
import { OpModalLocalsMap } from 'core-app/shared/components/modal/modal.types';
import { OpModalLocalsToken } from 'core-app/shared/components/modal/modal.service';
import { DatePicker } from 'core-app/shared/components/op-date-picker/datepicker';
import { HalResourceEditingService } from 'core-app/shared/components/fields/edit/services/hal-resource-editing.service';
import { ResourceChangeset } from 'core-app/shared/components/fields/changeset/resource-changeset';
import { BrowserDetector } from 'core-app/core/browser/browser-detector.service';
import { ConfigurationService } from 'core-app/core/config/configuration.service';
import { TimezoneService } from 'core-app/core/datetime/timezone.service';
import { DayElement } from 'flatpickr/dist/types/instance';
import flatpickr from 'flatpickr';
import { DatepickerModalService } from 'core-app/shared/components/datepicker/datepicker.modal.service';
import {
  debounce,
  take,
} from 'rxjs/operators';
import { activeFieldContainerClassName } from 'core-app/shared/components/fields/edit/edit-form/edit-form';
import {
  Subject,
  timer,
} from 'rxjs';

export type DateKeys = 'date'|'start'|'end';

@Component({
  templateUrl: './datepicker.modal.html',
  styleUrls: ['./datepicker.modal.sass', './datepicker_mobile.modal.sass'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  providers: [
    DatepickerModalService,
  ],
})
export class DatePickerModalComponent extends OpModalComponent implements AfterViewInit {
  @InjectField() I18n!:I18nService;

  @InjectField() timezoneService:TimezoneService;

  @InjectField() halEditing:HalResourceEditingService;

  @InjectField() datepickerService:DatepickerModalService;

  @InjectField() browserDetector:BrowserDetector;

  @ViewChild('modalContainer') modalContainer:ElementRef<HTMLElement>;

  text = {
    save: this.I18n.t('js.button_save'),
    cancel: this.I18n.t('js.button_cancel'),
    manualScheduling: this.I18n.t('js.scheduling.manual'),
    date: this.I18n.t('js.work_packages.properties.date'),
    startDate: this.I18n.t('js.work_packages.properties.startDate'),
    endDate: this.I18n.t('js.work_packages.properties.dueDate'),
    placeholder: this.I18n.t('js.placeholders.default'),
    today: this.I18n.t('js.label_today'),
  };

  onDataUpdated = new EventEmitter<string>();

  singleDate = false;

  scheduleManually = false;

  htmlId = '';

  dates:{ [key in DateKeys]:string } = {
    date: '',
    start: '',
    end: '',
  };

  dateChangedManually$ = new Subject<void>();

  private debounceDelay = 0; // will change after initial render

  private changeset:ResourceChangeset;

  private datePickerInstance:DatePicker;

  constructor(
    readonly injector:Injector,
    @Inject(OpModalLocalsToken) public locals:OpModalLocalsMap,
    readonly cdRef:ChangeDetectorRef,
    readonly elementRef:ElementRef,
    readonly configurationService:ConfigurationService,
  ) {
    super(locals, cdRef, elementRef);
    this.changeset = locals.changeset as ResourceChangeset;
    this.htmlId = `wp-datepicker-${locals.fieldName as string}`;

    this.singleDate = this.changeset.isWritable('date');
    this.scheduleManually = !!this.changeset.value('scheduleManually');

    if (this.singleDate) {
      this.dates.date = this.changeset.value('date') as string;
      this.datepickerService.setCurrentActivatedField('date');
    } else {
      this.dates.start = this.changeset.value('startDate') as string;
      this.dates.end = this.changeset.value('dueDate') as string;
      this.datepickerService.setCurrentActivatedField(this.initialActivatedField());
    }
  }

  ngAfterViewInit():void {
    this
      .datepickerService
      .precedingWorkPackages$
      .pipe(
        take(1),
      ).subscribe((relation) => {
        this.initializeDatepicker(this.minimalDateFromPrecedingRelationship(relation));
        this.onDataChange();
      });

    this
      .dateChangedManually$
      .pipe(
        // Avoid that the manual changes are moved to the datepicker too early.
        // The debounce is chosen quite large on purpose to catch the following case:
        //   1. Start date is for example 2022-07-15. The user wants to set the end date to the 19th.
        //   2. So he/she starts entering the finish date 2022-07-1 .
        //   3. This is already a valid date. Since it is before the start date,the start date would be changed automatically to the first without the debounce.
        //   4. The debounce gives the user enough time to type the last number "9" before the changes are converted to the datepicker and the start date would be affected.
        //
        // Debounce delay is 0 for initial display, and then set to 800
        debounce(() => timer(this.debounceDelay)),
      )
      .subscribe(() => {
        // set debounce delay to its real value
        this.debounceDelay = 800;

        // Always update the whole form to ensure that no values are lost/inconsistent
        if (this.singleDate) {
          this.updateDate('date', this.dates.date);
        } else if (this.datepickerService.currentlyActivatedDateField === 'start') {
          this.updateDate('end', this.dates.end);
          this.updateDate('start', this.dates.start);
        } else if (this.datepickerService.currentlyActivatedDateField === 'end') {
          this.updateDate('start', this.dates.start);
          this.updateDate('end', this.dates.end);
        }
      });
  }

  changeSchedulingMode():void {
    this.scheduleManually = !this.scheduleManually;
    this.initializeDatepicker();
    this.cdRef.detectChanges();
  }

  save($event:Event):void {
    $event.preventDefault();
    // Apply the changed scheduling mode if any
    this.changeset.setValue('scheduleManually', this.scheduleManually);

    // Apply the dates if they could be changed
    if (this.isSchedulable) {
      if (this.singleDate) {
        this.changeset.setValue('date', this.datepickerService.mappedDate(this.dates.date));
      } else {
        this.changeset.setValue('startDate', this.datepickerService.mappedDate(this.dates.start));
        this.changeset.setValue('dueDate', this.datepickerService.mappedDate(this.dates.end));
      }
    }

    this.closeMe();
  }

  cancel():void {
    this.closeMe();
  }

  updateDate(key:DateKeys, val:string):void {
    // Expected minimal format YYYY-M-D => 8 characters OR empty
    if (val.length >= 8 || val.length === 0) {
      this.dates[key] = val;
      if (this.datepickerService.validDate(val) && this.datePickerInstance) {
        const dateValue = this.datepickerService.parseDate(val) || undefined;
        this.enforceManualChangesToDatepicker(false, dateValue);
      }
    }
  }

  setToday(key:DateKeys):void {
    const today = this.datepickerService.parseDate(new Date());
    this.dates[key] = this.timezoneService.formattedISODate(today);

    if (today instanceof Date) {
      this.enforceManualChangesToDatepicker(true, today);
    } else {
      this.enforceManualChangesToDatepicker();
    }
  }

  // eslint-disable-next-line class-methods-use-this
  reposition(element:JQuery<HTMLElement>, target:JQuery<HTMLElement>):void {
    element.position({
      my: 'left top',
      at: 'left bottom',
      of: target,
      collision: 'flipfit',
    });
  }

  showTodayLink():boolean {
    return this.isSchedulable;
  }

  /**
   * Returns whether the user can alter the dates of the work package.
   */
  get isSchedulable():boolean {
    return this.scheduleManually || !this.datepickerService.isParent;
  }

  showFieldAsActive(field:DateKeys):boolean {
    return this.datepickerService.isStateOfCurrentActivatedField(field) && this.isSchedulable;
  }

  private initializeDatepicker(minimalDate?:Date|null) {
    this.datePickerInstance?.destroy();
    this.datePickerInstance = new DatePicker(
      this.injector,
      '#flatpickr-input',
      this.singleDate ? this.dates.date : [this.dates.start, this.dates.end],
      {
        mode: this.singleDate ? 'single' : 'range',
        showMonths: this.browserDetector.isMobile ? 1 : 2,
        inline: true,
        onReady: () => {
          this.reposition(jQuery(this.modalContainer.nativeElement), jQuery(`.${activeFieldContainerClassName}`));
        },
        onChange: (dates:Date[]) => {
          this.handleDatePickerChange(dates);

          this.onDataChange();
        },
        onDayCreate: (dObj:Date[], dStr:string, fp:flatpickr.Instance, dayElem:DayElement) => {
          if (this.datePickerInstance?.weekdaysService.isNonWorkingDay(dayElem.dateObj)) {
            dayElem.classList.add('flatpickr-non-working-day');
          }

          if (this.isDayDisabled(dayElem, minimalDate)) {
            dayElem.classList.add('flatpickr-disabled');
          }

          dayElem.setAttribute('data-iso-date', dayElem.dateObj.toISOString());
        },
      },
      null,
    );
  }

  private enforceManualChangesToDatepicker(toggleField = true, enforceDate?:Date) {
    if (this.singleDate) {
      const date = this.datepickerService.parseDate(this.dates.date);
      this.datepickerService.setDates(date, this.datePickerInstance, enforceDate);
    } else {
      let startDate = this.datepickerService.parseDate(this.dates.start);
      let endDate = this.datepickerService.parseDate(this.dates.end);

      if (startDate && endDate) {
        // If the start date is manually changed to be after the end date,
        // we adjust the end date to be at least the same as the newly entered start date.
        // Same applies if the end date is set manually before the current start date
        if (startDate > endDate && this.datepickerService.isStateOfCurrentActivatedField('start')) {
          endDate = startDate;
          this.dates.end = this.timezoneService.formattedISODate(endDate);

          this.cdRef.detectChanges();
        } else if (endDate < startDate && this.datepickerService.isStateOfCurrentActivatedField('end')) {
          startDate = endDate;
          this.dates.start = this.timezoneService.formattedISODate(startDate);

          this.cdRef.detectChanges();
        }
      }

      const dates = [startDate, endDate];
      this.datepickerService.setDates(dates, this.datePickerInstance, enforceDate);

      if (toggleField) {
        this.datepickerService.toggleCurrentActivatedField();
      }
    }
  }

  private handleDatePickerChange(dates:Date[]) {
    switch (dates.length) {
      case 1: {
        const selectedDate = dates[0];
        if (this.dates.start && this.dates.end) {
          /**
          Overwrite flatpickr default behavior by not starting a new date range everytime but preserving either start or end date.
          There are three cases to cover.
          1. Everything before the current start date will become the new start date (independent of the active field)
          2. Everything after the current end date will become the new end date if that is the currently active field.
          If the active field is the start date, the selected date becomes the new start date and the end date is cleared.
          3. Everything in between the current start and end date is dependent on the currently activated field.
          * */

          const parsedStartDate = this.datepickerService.parseDate(this.dates.start) as Date;
          const parsedEndDate = this.datepickerService.parseDate(this.dates.end) as Date;

          if (selectedDate < parsedStartDate) {
            this.overwriteDatePickerWithNewDates([selectedDate, parsedEndDate]);
            this.datepickerService.setCurrentActivatedField('end');
          } else if (selectedDate > parsedEndDate) {
            if (this.datepickerService.isStateOfCurrentActivatedField('end')) {
              this.overwriteDatePickerWithNewDates([parsedStartDate, selectedDate]);
            } else {
              this.dates.start = this.timezoneService.formattedISODate(selectedDate);
              this.dates.end = '';
              this.datepickerService.toggleCurrentActivatedField();
            }
          } else if (this.datepickerService.areDatesEqual(selectedDate, parsedStartDate) || this.datepickerService.areDatesEqual(selectedDate, parsedEndDate)) {
            this.overwriteDatePickerWithNewDates([selectedDate, selectedDate]);
          } else {
            const newDates = this.datepickerService.isStateOfCurrentActivatedField('start') ? [selectedDate, parsedEndDate] : [parsedStartDate, selectedDate];
            this.overwriteDatePickerWithNewDates(newDates);
          }
        } else {
          this.dates[this.datepickerService.currentlyActivatedDateField] = this.timezoneService.formattedISODate(selectedDate);
          this.datepickerService.toggleCurrentActivatedField();
        }

        break;
      }
      case 2: {
        // Write the dates to the input fields
        this.dates.start = this.timezoneService.formattedISODate(dates[0]);
        this.dates.end = this.timezoneService.formattedISODate(dates[1]);
        this.datepickerService.toggleCurrentActivatedField();
        break;
      }
      default: {
        break;
      }
    }

    this.cdRef.detectChanges();
  }

  private overwriteDatePickerWithNewDates(dates:Date[]) {
    this.datepickerService.setDates(dates, this.datePickerInstance);
    this.handleDatePickerChange(dates);
  }

  private onDataChange() {
    const date = this.dates.date || '';
    const start = this.dates.start || '';
    const end = this.dates.end || '';

    const output = this.singleDate ? date : `${start} - ${end}`;
    this.onDataUpdated.emit(output);
  }

  private initialActivatedField():DateKeys {
    return this.locals.fieldName === 'dueDate' ? 'end' : 'start';
  }

  private minimalDateFromPrecedingRelationship(relations:{ id:string, dueDate?:string, date?:string }[]):Date|null {
    if (relations.length === 0) {
      return null;
    }

    let minimalDate:Date|null = null;

    relations.forEach((relation) => {
      if (!relation.dueDate && !relation.date) {
        return;
      }

      const relationDate = relation.dueDate || relation.date;
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const parsedRelationDate = this.datepickerService.parseDate(relationDate!);

      if (!minimalDate || minimalDate < parsedRelationDate) {
        minimalDate = parsedRelationDate === '' ? null : parsedRelationDate;
      }
    });

    return minimalDate;
  }

  private isDayDisabled(dayElement:DayElement, minimalDate?:Date|null):boolean {
    return !this.isSchedulable || (!this.scheduleManually && !!minimalDate && dayElement.dateObj <= minimalDate);
  }
}
