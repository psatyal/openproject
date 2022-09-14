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
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ViewChild,
} from '@angular/core';

import { I18nService } from 'core-app/core/i18n/i18n.service';
import { TimezoneService } from 'core-app/core/datetime/timezone.service';
import { IFileIcon } from 'core-app/shared/components/file-links/file-link-icons/icon-mappings';
import { IFileLink, IFileLinkOriginData } from 'core-app/core/state/file-links/file-link.model';
import { fileLinkViewAllowed } from 'core-app/shared/components/file-links/file-links-constants.const';
import { PrincipalRendererService } from 'core-app/shared/components/principal/principal-renderer.service';
import {
  getIconForMimeType,
} from 'core-app/shared/components/file-links/file-link-icons/file-link-list-item-icon.factory';

@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: '[op-file-link-list-item]',
  templateUrl: './file-link-list-item.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FileLinkListItemComponent implements OnInit, AfterViewInit {
  @Input() public fileLink:IFileLink;

  @Input() public allowEditing = false;

  @Input() public disabled = true;

  @Output() public removeFileLink = new EventEmitter<void>();

  @ViewChild('avatar') avatar:ElementRef;

  infoTimestampText:string;

  fileLinkIcon:IFileIcon;

  downloadAllowed:boolean;

  viewAllowed:boolean;

  text = {
    title: {
      openFile: this.i18n.t('js.storages.file_links.open'),
      openFileLocation: this.i18n.t('js.storages.file_links.open_location'),
      removeFileLink: this.i18n.t('js.storages.file_links.remove'),
      downloadFileLink: '',
    },
    floatingText: {
      noViewPermission: this.i18n.t('js.storages.file_links.no_permission'),
    },
    removalConfirmation: this.i18n.t('js.storages.file_links.remove_confirmation'),
  };

  constructor(
    private readonly i18n:I18nService,
    private readonly timezoneService:TimezoneService,
    private readonly principalRendererService:PrincipalRendererService,
  ) {}

  private get originData():IFileLinkOriginData {
    return this.fileLink.originData;
  }

  ngOnInit():void {
    if (this.originData.lastModifiedAt) {
      this.infoTimestampText = this.timezoneService.parseDatetime(this.originData.lastModifiedAt).fromNow();
    }

    this.fileLinkIcon = getIconForMimeType(this.originData.mimeType);

    this.downloadAllowed = this.originData.mimeType !== 'application/x-op-directory';

    this.text.title.downloadFileLink = this.i18n.t(
      'js.storages.file_links.download',
      { fileName: this.fileLink.originData.name },
    );

    this.viewAllowed = this.fileLink._links.permission.href === fileLinkViewAllowed;
  }

  ngAfterViewInit():void {
    if (this.originData.lastModifiedByName) {
      this.principalRendererService.render(
        this.avatar.nativeElement,
        { name: this.originData.lastModifiedByName, href: '/external_users/1' },
        { hide: true, link: false },
        { hide: false, size: 'mini' },
      );
    } else {
      this.principalRendererService.render(
        this.avatar.nativeElement,
        { name: 'Not Available', href: '/placeholder_users/1' },
        { hide: true, link: false },
        { hide: false, size: 'mini' },
      );
    }
  }

  public confirmRemoveFileLink():void {
    if (window.confirm(this.text.removalConfirmation)) {
      this.removeFileLink.emit();
    }
  }
}
