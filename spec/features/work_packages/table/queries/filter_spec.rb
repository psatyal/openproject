#-- copyright
# OpenProject is an open source project management software.
# Copyright (C) 2012-2022 the OpenProject GmbH
#
# This program is free software; you can redistribute it and/or
# modify it under the terms of the GNU General Public License version 3.
#
# OpenProject is a fork of ChiliProject, which is a fork of Redmine. The copyright follows:
# Copyright (C) 2006-2013 Jean-Philippe Lang
# Copyright (C) 2010-2013 the ChiliProject Team
#
# This program is free software; you can redistribute it and/or
# modify it under the terms of the GNU General Public License
# as published by the Free Software Foundation; either version 2
# of the License, or (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
#
# See COPYRIGHT and LICENSE files for more details.
#++

require 'spec_helper'

describe 'filter work packages', js: true do
  let(:user) { create :admin }
  let(:watcher) { create :user }
  let(:project) { create :project, members: { watcher => role } }
  let(:role) { create :existing_role, permissions: [:view_work_packages] }
  let(:wp_table) { ::Pages::WorkPackagesTable.new(project) }
  let(:filters) { ::Components::WorkPackages::Filters.new }

  current_user { user }

  context 'by watchers' do
    let(:work_package_with_watcher) do
      wp = build :work_package, project: project
      wp.add_watcher watcher
      wp.save!

      wp
    end
    let(:work_package_without_watcher) { create :work_package, project: }

    before do
      work_package_with_watcher
      work_package_without_watcher

      wp_table.visit!
    end

    # Regression test for bug #24114 (broken watcher filter)
    it 'onlies filter work packages by watcher' do
      filters.open
      loading_indicator_saveguard

      filters.add_filter_by 'Watcher', 'is', watcher.name
      loading_indicator_saveguard

      wp_table.expect_work_package_listed work_package_with_watcher
      wp_table.ensure_work_package_not_listed! work_package_without_watcher
    end
  end

  context 'by version in project' do
    let(:version) { create :version, project: }
    let(:work_package_with_version) do
      create :work_package, project:, subject: 'With version', version:
    end
    let(:work_package_without_version) { create :work_package, subject: 'Without version', project: }

    before do
      work_package_with_version
      work_package_without_version

      wp_table.visit!
    end

    it 'allows filtering, saving, retrieving and altering the saved filter' do
      filters.open

      filters.add_filter_by('Version', 'is', version.name)

      loading_indicator_saveguard
      wp_table.expect_work_package_listed work_package_with_version
      wp_table.ensure_work_package_not_listed! work_package_without_version

      wp_table.save_as('Some query name')

      filters.remove_filter 'version'

      loading_indicator_saveguard
      wp_table.expect_work_package_listed work_package_with_version, work_package_without_version

      last_query = Query.last

      wp_table.visit_query(last_query)

      loading_indicator_saveguard
      wp_table.expect_work_package_listed work_package_with_version
      wp_table.ensure_work_package_not_listed! work_package_without_version

      filters.open

      filters.expect_filter_by('Version', 'is', version.name)

      filters.set_operator 'Version', 'is not'

      loading_indicator_saveguard
      wp_table.expect_work_package_listed work_package_without_version
      wp_table.ensure_work_package_not_listed! work_package_with_version
    end
  end

  context 'when filtering by status in project' do
    let(:status) { create :status, name: 'Open status' }
    let(:closed_status) { create :closed_status, name: 'Closed status' }
    let(:work_package_with_status) do
      create :work_package, project:, subject: 'With open status', status:
    end
    let(:work_package_without_status) { create :work_package, subject: 'With closed status', project:, status: closed_status }

    before do
      work_package_with_status
      work_package_without_status

      wp_table.visit!
    end

    it 'allows filtering and matching the selected value' do
      filters.open

      filters.remove_filter :status
      filters.expect_no_filter_by :status
      filters.add_filter_by('Status', 'is', status.name)

      loading_indicator_saveguard
      wp_table.expect_work_package_listed work_package_with_status
      wp_table.ensure_work_package_not_listed! work_package_without_status

      filters.open_autocompleter :status

      expect(page).to have_selector('.ng-option', text: closed_status.name)
      expect(page).to have_no_selector('.ng-option', text: status.name)
    end
  end

  context 'by finish date outside of a project' do
    let(:work_package_with_due_date) { create :work_package, project:, due_date: Date.today }
    let(:work_package_without_due_date) { create :work_package, project:, due_date: Date.today + 5.days }
    let(:wp_table) { ::Pages::WorkPackagesTable.new }

    before do
      work_package_with_due_date
      work_package_without_due_date

      wp_table.visit!
    end

    it 'allows filtering, saving and retrieving and altering the saved filter' do
      filters.open

      filters.add_filter_by('Finish date',
                            'between',
                            [(Date.today - 1.day).strftime('%Y-%m-%d'), Date.today.strftime('%Y-%m-%d')],
                            'dueDate')

      loading_indicator_saveguard
      wp_table.expect_work_package_listed work_package_with_due_date
      wp_table.ensure_work_package_not_listed! work_package_without_due_date

      wp_table.save_as('Some query name')

      filters.remove_filter 'dueDate'

      loading_indicator_saveguard
      wp_table.expect_work_package_listed work_package_with_due_date, work_package_without_due_date

      last_query = Query.last

      wp_table.visit_query(last_query)

      loading_indicator_saveguard
      wp_table.expect_work_package_listed work_package_with_due_date
      wp_table.ensure_work_package_not_listed! work_package_without_due_date

      filters.open

      filters.expect_filter_by('Finish date',
                               'between',
                               [(Date.today - 1.day).strftime('%Y-%m-%d'), Date.today.strftime('%Y-%m-%d')],
                               'dueDate')

      filters.set_filter 'Finish date', 'in more than', '1', 'dueDate'

      loading_indicator_saveguard
      wp_table.expect_work_package_listed work_package_without_due_date
      wp_table.ensure_work_package_not_listed! work_package_with_due_date
    end
  end

  context 'by list cf inside a project' do
    let(:type) do
      type = create(:type)

      project.types << type

      type
    end

    let(:work_package_with_list_value) do
      wp = create :work_package, project: project, type: type
      wp.send("#{list_cf.accessor_name}=", list_cf.custom_options.first.id)
      wp.save!
      wp
    end

    let(:work_package_with_anti_list_value) do
      wp = create :work_package, project: project, type: type
      wp.send("#{list_cf.accessor_name}=", list_cf.custom_options.last.id)
      wp.save!
      wp
    end

    let(:list_cf) do
      cf = create :list_wp_custom_field

      project.work_package_custom_fields << cf
      type.custom_fields << cf

      cf
    end

    before do
      list_cf
      work_package_with_list_value
      work_package_with_anti_list_value

      wp_table.visit!
    end

    it 'allows filtering, saving and retrieving the saved filter' do
      # Wait for form to load
      filters.expect_loaded

      filters.open
      filters.add_filter_by(list_cf.name,
                            'is not',
                            list_cf.custom_options.last.value,
                            "customField#{list_cf.id}")

      loading_indicator_saveguard
      wp_table.expect_work_package_listed work_package_with_list_value
      wp_table.ensure_work_package_not_listed! work_package_with_anti_list_value

      wp_table.save_as('Some query name')

      filters.remove_filter "customField#{list_cf.id}"

      loading_indicator_saveguard
      wp_table.expect_work_package_listed work_package_with_list_value, work_package_with_anti_list_value

      last_query = Query.last

      wp_table.visit_query(last_query)

      loading_indicator_saveguard
      wp_table.expect_work_package_listed work_package_with_list_value
      wp_table.ensure_work_package_not_listed! work_package_with_anti_list_value

      filters.open

      filters.expect_filter_by(list_cf.name,
                               'is not',
                               list_cf.custom_options.last.value,
                               "customField#{list_cf.id}")
    end
  end

  context 'by string cf inside a project with url-query relevant chars' do
    let(:type) do
      type = create(:type)

      project.types << type

      type
    end

    let(:work_package_plus) do
      wp = create :work_package, project: project, type: type
      wp.send("#{string_cf.accessor_name}=", 'G+H')
      wp.save!
      wp
    end

    let(:work_package_and) do
      wp = create :work_package, project: project, type: type
      wp.send("#{string_cf.accessor_name}=", 'A&B')
      wp.save!
      wp
    end

    let(:string_cf) do
      cf = create :string_wp_custom_field

      project.work_package_custom_fields << cf
      type.custom_fields << cf

      cf
    end

    before do
      string_cf
      work_package_plus
      work_package_and

      wp_table.visit!
    end

    it 'allows filtering, saving and retrieving the saved filter' do
      # Wait for form to load
      filters.expect_loaded

      filters.open
      filters.add_filter_by(string_cf.name,
                            'is',
                            ['G+H'],
                            "customField#{string_cf.id}")

      loading_indicator_saveguard
      wp_table.expect_work_package_listed work_package_plus
      wp_table.ensure_work_package_not_listed! work_package_and

      wp_table.save_as('Some query name')

      filters.remove_filter "customField#{string_cf.id}"

      loading_indicator_saveguard
      wp_table.expect_work_package_listed work_package_plus, work_package_and

      last_query = Query.last

      wp_table.visit_query(last_query)

      loading_indicator_saveguard
      wp_table.expect_work_package_listed work_package_plus
      wp_table.ensure_work_package_not_listed! work_package_and

      filters.open

      filters.expect_filter_by(string_cf.name,
                               'is',
                               ['G+H'],
                               "customField#{string_cf.id}")

      filters.set_filter(string_cf,
                         'is',
                         ['A&B'],
                         "customField#{string_cf.id}")

      loading_indicator_saveguard
      wp_table.expect_work_package_listed work_package_and
      wp_table.ensure_work_package_not_listed! work_package_plus
    end
  end

  context 'by attachment content' do
    let(:attachment_a) { build(:attachment, filename: 'attachment-first.pdf') }
    let(:attachment_b) { build(:attachment, filename: 'attachment-second.pdf') }
    let(:wp_with_attachment_a) do
      create :work_package, subject: 'WP attachment A', project:, attachments: [attachment_a]
    end
    let(:wp_with_attachment_b) do
      create :work_package, subject: 'WP attachment B', project:, attachments: [attachment_b]
    end
    let(:wp_without_attachment) { create :work_package, subject: 'WP no attachment', project: }
    let(:wp_table) { ::Pages::WorkPackagesTable.new }

    before do
      allow(EnterpriseToken).to receive(:allows_to?).and_return(false)
      allow(EnterpriseToken).to receive(:allows_to?).with(:attachment_filters).and_return(true)

      allow_any_instance_of(Plaintext::Resolver).to receive(:text).and_return('I am the first text $1.99.')
      wp_with_attachment_a
      ExtractFulltextJob.perform_now(attachment_a.id)
      allow_any_instance_of(Plaintext::Resolver).to receive(:text).and_return('I am the second text.')
      wp_with_attachment_b
      ExtractFulltextJob.perform_now(attachment_b.id)
      wp_without_attachment
    end

    context 'with full text search capabilities' do
      before do
        skip("Database does not support full text search.") unless OpenProject::Database::allows_tsv?
      end

      it 'allows filtering and retrieving and altering the saved filter' do
        wp_table.visit!
        wp_table.expect_work_package_listed wp_with_attachment_a, wp_with_attachment_b

        filters.open

        # content contains with multiple hits
        filters.add_filter_by('Attachment content',
                              'contains',
                              ['text'],
                              'attachmentContent')

        loading_indicator_saveguard
        wp_table.expect_work_package_listed wp_with_attachment_a, wp_with_attachment_b
        wp_table.ensure_work_package_not_listed! wp_without_attachment

        # content contains single hit with numbers
        filters.remove_filter 'attachmentContent'

        filters.add_filter_by('Attachment content',
                              'contains',
                              ['first 1.99'],
                              'attachmentContent')

        loading_indicator_saveguard
        wp_table.expect_work_package_listed wp_with_attachment_a
        wp_table.ensure_work_package_not_listed! wp_without_attachment, wp_with_attachment_b

        filters.remove_filter 'attachmentContent'

        # content does not contain
        filters.add_filter_by('Attachment content',
                              'doesn\'t contain',
                              ['first'],
                              'attachmentContent')

        loading_indicator_saveguard
        wp_table.expect_work_package_listed wp_with_attachment_b, wp_without_attachment
        wp_table.ensure_work_package_not_listed! wp_with_attachment_a

        filters.remove_filter 'attachmentContent'

        # ignores special characters
        filters.add_filter_by('Attachment content',
                              'contains',
                              ['! first:* \')'],
                              'attachmentContent')

        loading_indicator_saveguard
        wp_table.expect_work_package_listed wp_with_attachment_a
        wp_table.ensure_work_package_not_listed! wp_without_attachment, wp_with_attachment_b

        filters.remove_filter 'attachmentContent'

        # file name contains
        filters.add_filter_by('Attachment file name',
                              'contains',
                              ['first'],
                              'attachmentFileName')

        loading_indicator_saveguard
        wp_table.expect_work_package_listed wp_with_attachment_a
        wp_table.ensure_work_package_not_listed! wp_without_attachment, wp_with_attachment_b

        filters.remove_filter 'attachmentFileName'

        # file name does not contain
        filters.add_filter_by('Attachment file name',
                              'doesn\'t contain',
                              ['first'],
                              'attachmentFileName')

        loading_indicator_saveguard
        wp_table.expect_work_package_listed wp_with_attachment_b
        wp_table.ensure_work_package_not_listed! wp_with_attachment_a
      end
    end
  end

  context 'DB does not offer TSVector support' do
    before do
      allow(OpenProject::Database).to receive(:allows_tsv?).and_return(false)
    end

    it "does not offer attachment filters" do
      expect(page).not_to have_select 'add_filter_select', with_options: ['Attachment content', 'Attachment file name']
    end
  end

  describe 'specific filters' do
    describe 'filters on date by created_at (Regression #28459)' do
      let!(:wp_updated_today) do
        create :work_package, subject: 'Created today', project:, created_at: (Date.today + 12.hours)
      end
      let!(:wp_updated_5d_ago) do
        create :work_package, subject: 'Created 5d ago', project:, created_at: (Date.today - 5.days)
      end

      it do
        wp_table.visit!
        loading_indicator_saveguard
        wp_table.expect_work_package_listed wp_updated_today, wp_updated_5d_ago

        filters.open

        filters.add_filter_by 'Created on',
                              'on',
                              [Date.today.iso8601],
                              'createdAt'

        loading_indicator_saveguard

        wp_table.expect_work_package_listed wp_updated_today
        wp_table.ensure_work_package_not_listed! wp_updated_5d_ago
      end
    end
  end

  describe 'keep the filter attribute order (Regression #33136)' do
    let(:version1) { create :version, project:, name: 'Version 1', id: 1 }
    let(:version2) { create :version, project:, name: 'Version 2', id: 2 }

    it do
      wp_table.visit!
      loading_indicator_saveguard

      filters.open
      filters.add_filter_by 'Version', 'is', [version2.name, version1.name]
      loading_indicator_saveguard

      sleep(3)

      filters.expect_filter_by 'Version', 'is', [version1.name]
      filters.expect_filter_by 'Version', 'is', [version2.name]

      # Order should stay unchanged
      filters.expect_filter_order('Version', [version2.name, version1.name])
    end
  end

  describe 'add parent WP filter' do
    let(:wp_parent) { create :work_package, project:, subject: 'project' }
    let(:wp_child1) { create :work_package, project:, subject: 'child 1', parent: wp_parent }
    let(:wp_child2) { create :work_package, project:, subject: 'child 2', parent: wp_parent }
    let(:wp_default) { create :work_package, project:, subject: 'default' }

    it do
      wp_parent
      wp_child1
      wp_child2
      wp_default
      wp_table.visit!
      loading_indicator_saveguard
      filters.expect_loaded
      filters.open
      filters.add_filter_by 'Parent', 'is', [wp_parent.subject]
      loading_indicator_saveguard

      # It should show the children of the selected parent
      wp_table.expect_work_package_listed wp_child1, wp_child2
      wp_table.ensure_work_package_not_listed! wp_default
    end
  end
end
