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
  Component,
  ElementRef,
  Input,
  OnInit,
  ViewChild,
} from '@angular/core';
import {
  CalendarOptions,
  DateSelectArg,
  EventDropArg,
  EventInput,
} from '@fullcalendar/core';
import { EventClickArg, FullCalendarComponent, ToolbarInput } from '@fullcalendar/angular';
import dayGridPlugin from '@fullcalendar/daygrid';
import * as moment from 'moment';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

import { States } from 'core-app/core/states/states.service';
import { IsolatedQuerySpace } from 'core-app/features/work-packages/directives/query-space/isolated-query-space';
import { WorkPackageResource } from 'core-app/features/hal/resources/work-package-resource';
import { WorkPackageCollectionResource } from 'core-app/features/hal/resources/wp-collection-resource';
import {
  WorkPackageViewFiltersService,
} from 'core-app/features/work-packages/routing/wp-view-base/view-services/wp-view-filters.service';
import { WorkPackagesListService } from 'core-app/features/work-packages/components/wp-list/wp-list.service';
import { StateService } from '@uirouter/core';
import { I18nService } from 'core-app/core/i18n/i18n.service';
import { ToastService } from 'core-app/shared/components/toaster/toast.service';
import { DomSanitizer } from '@angular/platform-browser';
import { ConfigurationService } from 'core-app/core/config/configuration.service';
import { UntilDestroyedMixin } from 'core-app/shared/helpers/angular/until-destroyed.mixin';
import { SchemaCacheService } from 'core-app/core/schemas/schema-cache.service';
import { CurrentProjectService } from 'core-app/core/current-project/current-project.service';
import interactionPlugin, { EventResizeDoneArg } from '@fullcalendar/interaction';
import {
  HalResourceEditingService,
} from 'core-app/shared/components/fields/edit/services/hal-resource-editing.service';
import { HalResourceNotificationService } from 'core-app/features/hal/services/hal-resource-notification.service';
import { splitViewRoute } from 'core-app/features/work-packages/routing/split-view-routes.helper';
import {
  CalendarViewEvent,
  OpWorkPackagesCalendarService,
} from 'core-app/features/calendar/op-work-packages-calendar.service';
import { OpCalendarService } from 'core-app/features/calendar/op-calendar.service';

@Component({
  templateUrl: './wp-calendar.template.html',
  styleUrls: ['./wp-calendar.sass'],
  selector: 'op-wp-calendar',
  providers: [
    OpWorkPackagesCalendarService,
    OpCalendarService,
  ],
})
export class WorkPackagesCalendarComponent extends UntilDestroyedMixin implements OnInit {
  @ViewChild(FullCalendarComponent) ucCalendar:FullCalendarComponent;

  @ViewChild('ucCalendar', { read: ElementRef })
  set ucCalendarElement(v:ElementRef|undefined) {
    this.calendar.resizeObserver(v);
  }

  @Input() static = false;

  calendarOptions$ = new Subject<CalendarOptions>();

  private alreadyLoaded = false;

  constructor(
    readonly states:States,
    readonly $state:StateService,
    readonly wpTableFilters:WorkPackageViewFiltersService,
    readonly wpListService:WorkPackagesListService,
    readonly querySpace:IsolatedQuerySpace,
    readonly schemaCache:SchemaCacheService,
    private element:ElementRef,
    readonly i18n:I18nService,
    readonly toastService:ToastService,
    private sanitizer:DomSanitizer,
    private configuration:ConfigurationService,
    readonly calendar:OpCalendarService,
    readonly workPackagesCalendar:OpWorkPackagesCalendarService,
    readonly currentProject:CurrentProjectService,
    readonly halEditing:HalResourceEditingService,
    readonly halNotification:HalResourceNotificationService,
  ) {
    super();
  }

  ngOnInit():void {
    this.wpTableFilters.hidden.push(
      'project',
    );
    this.calendar.resize$
      .pipe(
        this.untilDestroyed(),
        debounceTime(50),
      )
      .subscribe(() => {
        this.ucCalendar.getApi().updateSize();
      });

    // Clear any old subscribers
    this.querySpace.stopAllSubscriptions.next();

    this.setupWorkPackagesListener();
    this.initializeCalendar();
  }

  public calendarEventsFunction(fetchInfo:{ start:Date, end:Date, timeZone:string },
    successCallback:(events:EventInput[]) => void):void|PromiseLike<EventInput[]> {
    if (this.alreadyLoaded) {
      this.alreadyLoaded = false;
      const events = this.updateResults(this.querySpace.results.value!);
      successCallback(events);
    } else {
      this
        .workPackagesCalendar
        .currentWorkPackages$
        .subscribe((collection:WorkPackageCollectionResource) => {
          const events = this.updateResults((collection));
          successCallback(events);
        });
    }

    void this.workPackagesCalendar.updateTimeframe(fetchInfo, this.currentProject.identifier || undefined);
  }

  // eslint-disable-next-line @angular-eslint/use-lifecycle-interface
  ngOnDestroy():void {
    super.ngOnDestroy();
    this.calendar.resizeObs?.disconnect();
  }

  private initializeCalendar() {
    const additionalOptions:{ [key:string]:unknown } = {
      height: '100%',
      headerToolbar: this.buildHeader(),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      events: this.calendarEventsFunction.bind(this),
      plugins: [
        dayGridPlugin,
        interactionPlugin,
      ],
      // DnD configuration
      selectable: true,
      select: this.handleDateClicked.bind(this) as unknown,
      eventResizableFromStart: true,
      editable: true,
      eventDidMount: (evt:CalendarViewEvent) => {
        const { el, event } = evt;
        const workPackage = event.extendedProps.workPackage as WorkPackageResource;
        el.dataset.workPackageId = workPackage.id as string;
      },
      eventResize: (resizeInfo:EventResizeDoneArg) => this.updateEvent(resizeInfo),
      eventDrop: (dropInfo:EventDropArg) => this.updateEvent(dropInfo),
      eventClick: (evt:EventClickArg) => {
        const workPackageId = (evt.event.extendedProps.workPackage as WorkPackageResource).id as string;
        // Currently the calendar widget is shown on multiple pages,
        // but only the calendar module itself is a partitioned query space which can deal with a split screen request
        if (this.$state.includes('calendar')) {
          this.workPackagesCalendar.openSplitView(workPackageId);
        } else {
          void this.$state.go(
            'work-packages.show',
            { workPackageId },
          );
        }
      },
    };

    if (this.static) {
      additionalOptions.initialView = 'dayGridWeek';
    }

    void this.configuration.initialized
      .then(() => {
        this.calendarOptions$.next(
          this.workPackagesCalendar.calendarOptions(additionalOptions),
        );
      });
  }

  public buildHeader():false|ToolbarInput|undefined {
    if (this.static) {
      return false;
    }
    return {
      right: 'dayGridMonth,dayGridWeek',
      center: 'title',
      left: 'prev,next today',
    };
  }

  public openContextMenu(event:MouseEvent):void {
    const eventContainer = (event.target as HTMLElement).closest('.fc-event') as HTMLElement|undefined;
    if (!eventContainer) {
      return;
    }

    const workPackageId = eventContainer.dataset.workPackageId as string;
    this.workPackagesCalendar.showEventContextMenu({ workPackageId, event });
  }

  private setupWorkPackagesListener():void {
    this.workPackagesCalendar.workPackagesListener$(() => {
      this.alreadyLoaded = true;
      this.ucCalendar.getApi().refetchEvents();
    });
  }

  private updateResults(collection:WorkPackageCollectionResource) {
    this.workPackagesCalendar.warnOnTooManyResults(collection, this.static);
    return this.mapToCalendarEvents(collection.elements);
  }

  private mapToCalendarEvents(workPackages:WorkPackageResource[]) {
    return workPackages.map((workPackage:WorkPackageResource) => {
      const startDate = this.workPackagesCalendar.eventDate(workPackage, 'start');
      const endDate = this.workPackagesCalendar.eventDate(workPackage, 'due');

      const exclusiveEnd = moment(endDate).add(1, 'days').format('YYYY-MM-DD');

      return {
        title: workPackage.subject,
        start: startDate,
        editable: this.workPackagesCalendar.eventDurationEditable(workPackage),
        end: exclusiveEnd,
        allDay: true,
        className: `__hl_background_type_${workPackage.type.id || ''}`,
        workPackage,
      };
    });
  }

  private async updateEvent(info:EventResizeDoneArg|EventDropArg):Promise<void> {
    const changeset = this.workPackagesCalendar.updateDates(info);

    try {
      const result = await this.halEditing.save(changeset);
      this.halNotification.showSave(result.resource, result.wasNew);
    } catch (e) {
      this.halNotification.handleRawError(e, changeset.projectedResource);
      info.revert();
    }
  }

  private handleDateClicked(info:DateSelectArg) {
    const defaults = {
      startDate: info.startStr,
      dueDate: this.workPackagesCalendar.getEndDateFromTimestamp(info.endStr),
    };

    void this.$state.go(
      splitViewRoute(this.$state, 'new'),
      {
        defaults,
        tabIdentifier: 'overview',
      },
    );
  }
}
