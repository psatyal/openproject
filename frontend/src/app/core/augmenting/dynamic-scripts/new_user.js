//-- copyright
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


(function() {
  /**
   * When the user chooses the default internal authentication mode
   * no login field is shown as the email is taken by default.
   * If another mode is chosen (e.g. LDAP) the field is shown as it
   * may be required by the auth source.
   */
  var toggleLogin = function() {
    var newUserLogin = jQuery('#new_user_login');

    if (this.value === '') {
      newUserLogin.hide();
      newUserLogin.find('input').prop('disabled', true);
    } else {
      newUserLogin.show();
      newUserLogin.find('input').prop('disabled', false);
    }
  };

  jQuery(function init(){
    var select = jQuery('#user_auth_source_id');

    select.on('change.toggleNewUserLogin', toggleLogin);
    toggleLogin();
  });
})();
