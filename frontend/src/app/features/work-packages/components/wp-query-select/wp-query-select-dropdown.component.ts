// -- copyright
// OpenProject is an open source project management software.
// Copyright (C) 2012-2021 the OpenProject GmbH
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

import { States } from 'core-app/core/states/states.service';
import { StateService, TransitionService } from '@uirouter/core';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { LoadingIndicatorService } from 'core-app/core/loading-indicator/loading-indicator.service';
import { I18nService } from 'core-app/core/i18n/i18n.service';
import { PathHelperService } from 'core-app/core/path-helper/path-helper.service';
import { WorkPackageStaticQueriesService } from 'core-app/features/work-packages/components/wp-query-select/wp-static-queries.service';
import { QueryResource } from 'core-app/features/hal/resources/query-resource';
import { isClickedWithModifier } from 'core-app/shared/helpers/link-handling/link-handling';
import { CurrentProjectService } from 'core-app/core/current-project/current-project.service';
import { KeyCodes } from 'core-app/shared/helpers/keyCodes.enum';
import { UntilDestroyedMixin } from 'core-app/shared/helpers/angular/until-destroyed.mixin';
import { APIV3Service } from 'core-app/core/apiv3/api-v3.service';
import { MainMenuNavigationService } from 'core-app/core/main-menu/main-menu-navigation.service';
import { MainMenuToggleService } from 'core-app/core/main-menu/main-menu-toggle.service';
import { CollectionResource } from 'core-app/features/hal/resources/collection-resource';
import { IOpSidemenuItem } from 'core-app/shared/components/sidemenu/sidemenu.component';

export type QueryCategory = 'starred'|'public'|'private'|'default';

export interface IAutocompleteItem {
  // Some optional identifier
  identifier?:string;
  // Internal id for selecting items
  auto_id?:number;
  // The autocomplete item may be a static link (e.g., summary page)
  static_link?:string;
  // Label for the current locale
  label:string;
  // May be tied to a persisted query
  query?:QueryResource;
  // Or a loose map of query_props
  query_props?:any;
  // And is tied to a category
  category?:QueryCategory;
}

interface IQueryAutocompleteJQuery extends JQuery {
  querycomplete(...args:any[]):void;
}

export const wpQuerySelectSelector = 'wp-query-select';

@Component({
  selector: wpQuerySelectSelector,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './wp-query-select.template.html',
})
export class WorkPackageQuerySelectDropdownComponent extends UntilDestroyedMixin implements OnInit, OnDestroy {
  @ViewChild('wpQueryMenuSearchInput', { static: true }) _wpQueryMenuSearchInput:ElementRef;

  @ViewChild('queryResultsContainer', { static: true }) _queryResultsContainerElement:ElementRef;

  public loading = false;

  public noResults = false;

  public queryCategories:IOpSidemenuItem[] = [];

  public text = {
    search: this.I18n.t('js.toolbar.search_query_label'),
    label: this.I18n.t('js.toolbar.search_query_label'),
    scope_default: this.I18n.t('js.label_default_queries'),
    scope_starred: this.I18n.t('js.label_starred_queries'),
    scope_global: this.I18n.t('js.label_global_queries'),
    scope_private: this.I18n.t('js.label_custom_queries'),
    no_results: this.I18n.t('js.work_packages.query.text_no_results'),
  };

  private unregisterTransitionListener:Function;

  private projectIdentifier:string|null;

  private hiddenCategories:any = [];

  private reportsBodySelector = '.controller-work_packages\\/reports';

  private queryResultsContainer:JQuery;

  private buttonArrowLeft:JQuery;

  private searchInput:IQueryAutocompleteJQuery;

  private initialized = false;

  constructor(readonly ref:ChangeDetectorRef,
    readonly element:ElementRef,
    readonly apiV3Service:APIV3Service,
    readonly $state:StateService,
    readonly $transitions:TransitionService,
    readonly I18n:I18nService,
    readonly states:States,
    readonly CurrentProject:CurrentProjectService,
    readonly loadingIndicator:LoadingIndicatorService,
    readonly pathHelper:PathHelperService,
    readonly wpStaticQueries:WorkPackageStaticQueriesService,
    readonly mainMenuService:MainMenuNavigationService,
    readonly toggleService:MainMenuToggleService,
    readonly cdRef:ChangeDetectorRef) {
    super();
  }

  ngOnInit():void {
    this.queryResultsContainer = jQuery(this._queryResultsContainerElement.nativeElement);
    this.projectIdentifier = this.element.nativeElement.getAttribute('data-project-identifier');

    // When activating the work packages submenu,
    // either initially or through click on the toggle, load the results
    this.mainMenuService
      .onActivate('work_packages', 'work_packages_query_select')
      .subscribe(() => this.initializeAutocomplete());

    // Register click handler on results
    this.addClickHandler();
    this.cdRef.detach();
  }

  ngOnDestroy():void {
    super.ngOnDestroy();
    this.unregisterTransitionListener();
  }

  private initializeAutocomplete():void {
    if (this.initialized) {
      return;
    }

    this.searchInput = jQuery(this._wpQueryMenuSearchInput.nativeElement) as any;
    this.buttonArrowLeft = jQuery('.main-menu--arrow-left-to-project', jQuery('#main-menu-work-packages-wrapper').parent()) as any;
    this.initialized = true;
    this.buttonArrowLeft.focus();
    this.setupAutoCompletion(this.searchInput);
    this.updateMenuOnChanges();
    this.loadQueries();

    // TODO: replace old logic with this, once it is functional
    this.initializeQueries();
  }

  private initializeQueries():void {
    this.queryCategories = [];
    const categories:{ [category:string]:IOpSidemenuItem[] } = {
      starred: [],
      default: [],
      public: [],
      private: [],
    };

    // TODO: use global query store
    this.apiV3Service
      .queries
      .filterNonHidden(this.CurrentProject.identifier)
      .pipe(this.untilDestroyed())
      .subscribe((queryCollection) => {
        queryCollection.elements.forEach((query) => {
          let cat = 'private';
          if (query.public) {
            cat = 'public';
          }
          if (query.starred) {
            cat = 'starred';
          }

          categories[cat].push(this.toOpSideMenuItem(query));
        });

        this.insertCategoryMap(categories);
      });
  }

  private toOpSideMenuItem(query:QueryResource):IOpSidemenuItem {
    // TODO: use uiSref instead of href to prevent full reload of the page
    return { title: query.name, href: this.getQueryLink(query) };
  }

  private insertCategoryMap(categories:{ [category:string]:IOpSidemenuItem[] }):void {
    // TODO: check why "collapse" doesn't work
    this.queryCategories = [
      { title: this.text.scope_starred, children: categories.starred, collapsible: true },
      { title: this.text.scope_default, children: this.wpStaticQueries.allItems, collapsible: true },
      { title: this.text.scope_global, children: categories.public, collapsible: true },
      { title: this.text.scope_private, children: categories.private, collapsible: true },
    ];

    console.log(this.queryCategories);
    this.cdRef.detectChanges();
  }

  private transformQueries(collection:CollectionResource<QueryResource>) {
    const loadedQueries:IAutocompleteItem[] = collection.elements
      .map((query) => ({ label: query.name, query, query_props: null }));

    // Add to the loaded set of queries the fixed set of queries for the current project context
    const combinedQueries = loadedQueries.concat(this.wpStaticQueries.all);
    return this.sortQueries(combinedQueries);
  }

  // Filter the collection by categories, add the correct categories to every item of the filtered array
  // Sort every category array alphabetically, except the default queries
  private sortQueries(items:IAutocompleteItem[]):IAutocompleteItem[] {
    // Concat all categories in the right order
    const categorized:{ [category:string]:IAutocompleteItem[] } = {
      // Starred / favored
      starred: [],
      // default
      default: [],
      // public
      public: [],
      // private
      private: [],
    };

    let auto_id = 0;
    items.forEach((item):any => {
      item.auto_id = auto_id++;

      if (!item.query) {
        item.category = 'default';
        return categorized.default.push(item);
      }

      if (item.query.starred) {
        item.category = 'starred';
        return categorized.starred.push(item);
      }

      if (!item.query.starred && item.query.public) {
        item.category = 'public';
        return categorized.public.push(item);
      }

      if (!(item.query.starred || item.query.public)) {
        item.category = 'private';
        return categorized.private.push(item);
      }
    });

    return _.flatten(
      [categorized.starred, categorized.default, categorized.public, categorized.private]
        .map((items) => this.sortByLabel(items)),
    );
  }

  // Sort a given array of items by the value of their label attribute
  private sortByLabel(items:IAutocompleteItem[]):IAutocompleteItem[] {
    return items.sort((a, b) => a.label.toLowerCase().localeCompare(b.label.toLowerCase()));
  }

  private loadQueries() {
    return this.loadingPromise = this
      .apiV3Service
      .queries
      .filterNonHidden(this.CurrentProject.identifier)
      .toPromise()
      .then((collection) => {
        // Update the complete collection
        this.searchInput.querycomplete('option', { source: this.transformQueries(collection) });

        // To visibly show the changes, we need to search again
        this.searchInput.querycomplete('search', this.searchInput.val());

        // To search an empty string would expand all categories again every time
        // Remember all previously hidden categories and set them again after updating the menu
        _.each(this.hiddenCategories, (category) => {
          const thisCategory:string = jQuery(category).attr('category')!;
          this.expandCollapseCategory(thisCategory);
        });

        // Update view
        this.ref.detectChanges();
      });
  }

  private set loadingPromise(promise:Promise<any>) {
    this.loading = true;
    promise
      .then(() => {
        this.loading = false;
        this.cdRef.detectChanges();
      })
      .catch(() => {
        this.loading = false;
        this.cdRef.detectChanges();
      });
  }

  private setupAutoCompletion(input:IQueryAutocompleteJQuery) {
    this.defineJQueryQueryComplete();

    input.querycomplete({
      delay: 100,
      // The values are added later by the listener also covering
      // the changes to queries (updateMenuOnChanges()).
      source: [],
      select: (ul:any, selected:{ item:IAutocompleteItem }) => false, // Don't show title of selected query in the input field
      response: (event:any, ui:any) => {
        // Show the noResults span if we don't have any matches
        this.noResults = (ui.content.length === 0);
      },
      close: (event:any, ui:any) => {
        const autocompleteUi = this.queryResultsContainer.find('ul.ui-autocomplete');
        if (!autocompleteUi.is(':visible') && !this.noResults) {
          autocompleteUi.show();
        }
      },
      focus: (_event:JQuery.TriggeredEvent, ui:{ item:IAutocompleteItem }) => {
        let sourceEvent:any|null = _event;

        while (sourceEvent && sourceEvent.originalEvent) {
          sourceEvent = sourceEvent.originalEvent;
        }

        // Focus the given item, but only when we're using the keyboard.
        // With the mouse, hover shall suffice to avoid weird focus/hover combinations
        // e.g., https://community.openproject.com/wp/28197
        if (sourceEvent && sourceEvent.type === 'keydown') {
          this.queryResultsContainer
            .find(`#collapsible-menu-item-${ui.item.auto_id} .collapsible-menu--item-link`)
            .focus();
        }

        return false;
      },
      appendTo: '.collapsible-menu--results-container',
      classes: {
        'ui-autocomplete': 'collapsible-menu--search-ul -inplace',
        'ui-menu-divider': 'collapsible-menu--category-icon',
      },
      opAutofocus: false, // Don't automatically select first entry since we 'open' the autocomplete on page load
      minLength: 0,
    });
  }

  private defineJQueryQueryComplete() {
    const thisComponent = this;

    jQuery.widget('custom.querycomplete', jQuery.ui.autocomplete, {
      _create(this:any) {
        this._super();
        this.widget().menu('option', 'items', '.collapsible-menu--item');
        this._search('');
      },
      _renderItem(this:{}, ul:any, item:IAutocompleteItem) {
        const link = jQuery('<a>')
          .addClass('collapsible-menu--item-link')
          .attr('href', thisComponent.buildQueryItemUrl(item))
          .text(item.label);

        const li = jQuery('<li>')
          .addClass('ui-menu-item collapsible-menu--item')
          .attr('id', `collapsible-menu-item-${item.auto_id}`)
          .attr('data-category', item.category || '')
          .data('ui-autocomplete-item', item) // Focus method of autocompleter needs this data for accessibility - if not set, it will throw errors
          .append(link)
          .appendTo(ul);

        thisComponent.setInitialHighlighting(li, item);

        return li;
      },
      _renderMenu(this:any, ul:any, items:IAutocompleteItem[]) {
        let currentCategory:QueryCategory;

        _.each(items, (option) => {
          // Check if item has same category as previous item and if not insert a new category label in the list
          if (option.category !== currentCategory) {
            currentCategory = option.category!;
            const label = thisComponent.labelFunction(currentCategory);

            ul.append(`<a tabindex="0" class="collapsible-menu--category-icon collapsible-menu--category-toggle" data-category="${currentCategory}" aria-hidden="true"></a>`);
            jQuery('<li>')
              .addClass('ui-autocomplete--category collapsible-menu--category-toggle ellipsis')
              .attr('title', label)
              .attr('data-category', currentCategory)
              .text(label)
              .appendTo(ul);
          }
          this._renderItemData(ul, option);
        });

        // Scroll to selected element if search is empty
        if (thisComponent.searchInput.val() === '') {
          const selected = thisComponent.queryResultsContainer.find('.collapsible-menu--item.selected');
          if (selected.length > 0) {
            setTimeout(() => selected[0].scrollIntoView({ behavior: 'auto', block: 'center' }), 20);
          }
        }
      },
    });
  }

  // Set class 'selected' on initial rendering of the menu
  // Case 1: Wp menu is opened from somewhere else in the project -> Compare query params with url params and highlight selected
  // Case 2: Click on menu item 'Work Packages' (query 'All open' is opened on default) -> highlight 'All open'
  private setInitialHighlighting(currentLi:JQuery, item:IAutocompleteItem) {
    const params = this.getQueryParams(item);
    const currentId = this.$state.params.query_id;
    const currentProps = this.$state.params.query_props;
    const onWorkPackagesPage:boolean = this.$state.includes('work-packages');
    const onWorkPackagesReportPage:boolean = jQuery('body').hasClass('controller-work_packages/reports');

    // When the current ID is selected
    const currentIdSelected = params.query_id && (currentId || '').toString() === params.query_id.toString();

    // Case1: Static query props
    const matchesStaticQueryProps = !item.query && item.query_props && item.query_props === currentProps;

    // Case2: We're on the All open menu item
    const allOpen = onWorkPackagesPage && !currentId && !currentProps && item.identifier === 'all_open';

    // Case3: We're on the static summary page
    const onSummary = onWorkPackagesReportPage && item.identifier === 'summary';

    if (currentIdSelected || matchesStaticQueryProps || allOpen || onSummary) {
      currentLi.addClass('selected');
    }
  }

  private labelFunction(category:QueryCategory):string {
    switch (category) {
      case 'starred':
        return this.text.scope_starred;
      case 'public':
        return this.text.scope_global;
      case 'private':
        return this.text.scope_private;
      case 'default':
        return this.text.scope_default;
      default:
        return '';
    }
  }

  // Listens on all changes of queries (via an observable in the service), e.g. delete, create, rename, toggle starred
  // Update collection in autocompleter
  // Search again for the current value in input field to update the menu without loosing the current search results
  private updateMenuOnChanges() {
    this.states.changes.queries
      .pipe(
        this.untilDestroyed(),
      )
      .subscribe(() => this.loadQueries());
  }

  private expandCollapseCategory(category:string) {
    jQuery(`[data-category="${category}"]`)
      // Don't hide the categories themselves (Regression #28584)
      .not('.ui-autocomplete--category')
      .toggleClass('-hidden');
    jQuery(`.collapsible-menu--category-icon[data-category="${category}"]`).toggleClass('-collapsed');
  }

  // On click of a menu item, load requested query
  private loadQuery(item:IAutocompleteItem) {
    const params = this.getQueryParams(item);
    const opts = { reload: true };

    this.$state.go(
      'work-packages.partitioned.list',
      params,
      opts,
    );

    this.toggleService.closeWhenOnMobile();
  }

  private getQueryLink(query:QueryResource):string {
    const params = {
      query_id: query.id,
      query_props: null,
      projects: 'projects',
      projectPath: this.projectIdentifier,
    };
    return this.$state.href('work-packages.partitioned.list', params);
  }

  private getQueryParams(item:IAutocompleteItem) {
    const val:{ query_id:string|null, query_props:string|null, projects?:string, projectPath?:string } = {
      query_id: item.query ? _.toString(item.query.id) : null,
      query_props: item.query ? null : item.query_props,
    };

    if (this.projectIdentifier) {
      val.projects = 'projects';
      val.projectPath = this.projectIdentifier;
    }

    return val;
  }

  private buildQueryItemUrl(item:IAutocompleteItem):string {
    // Static item (such as summary)
    if (item.static_link) {
      return item.static_link;
    }

    const params = this.getQueryParams(item);
    return this.$state.href('work-packages.partitioned.list', params);
  }

  private highlightSelected(item:IAutocompleteItem) {
    this.highlightBySelector(`#collapsible-menu-item-${item.auto_id}`);
  }

  private highlightBySelector(selector:string) {
    // Remove old selection
    this.queryResultsContainer.find('.ui-menu-item').removeClass('selected');
    // Find selected element in DOM and highlight it
    this.queryResultsContainer.find(selector).addClass('selected');
  }

  /**
   * When clicking an item with meta keys,
   * avoid its propagation.
   *
   */
  private addClickHandler() {
    this.queryResultsContainer
      .on('click keydown', '.ui-menu-item a', (evt:JQuery.TriggeredEvent) => {
        if (evt.type === 'keydown' && evt.which !== KeyCodes.ENTER) {
          return true;
        }

        // Find the item from the clicked element
        const target = jQuery(evt.target);
        const item:IAutocompleteItem = target
          .closest('.collapsible-menu--item')
          .data('ui-autocomplete-item');

        // Either the link is clicked with a modifier, then always cancel any propagation
        const clickedWithModifier = evt.type === 'click' && isClickedWithModifier(evt);

        // Or the item is only a static link, then cancel propagation
        const isStatic = !!item.static_link;

        if (clickedWithModifier || isStatic) {
          evt.stopImmediatePropagation();

          if (evt.type === 'keydown') {
            window.location.href = target.attr('href')!;
          }
        } else {
          // If neither clicked with modifier nor static
          // Then prevent the default link handling and load the query
          evt.preventDefault();
          this.loadQuery(item);
          this.highlightSelected(item);
          return false;
        }

        return true;
      })
      .on('click keydown', '.collapsible-menu--category-toggle', (evt:JQuery.TriggeredEvent) => {
        if (evt.type === 'keydown' && evt.which !== KeyCodes.ENTER) {
          return true;
        }

        const target = jQuery(evt.target);
        const clickedCategory = target.data('category');

        if (clickedCategory) {
          this.expandCollapseCategory(clickedCategory);
        }

        // Remember all hidden catagories
        this.hiddenCategories = this.queryResultsContainer.find('.ui-autocomplete--category.hidden');

        evt.preventDefault();
        return false;
      });
  }
}
