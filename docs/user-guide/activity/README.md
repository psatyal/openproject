---
sidebar_navigation:
  title: Activity
  priority: 890
description: Find out about the Activity within a project
keywords: activity
---

# Activity

In OpenProject you can display the activities in a project to gain a quick overview about the current status and changes. The activity page lists the newest developments in your project.

<div class="glossary">
**Activity** is defined as a module that displays the actions performed in a project over a certain period of time.
</div>

The changes are listed in newest first order, with the latest changes appearing on top. Apply a filter (located below the project navigation on the left), to select which attributes are included in the activity.

The activity includes changes to work packages, repository changes, new, wiki entries or forum messages.

## Activate Activity in a project

To activate the Activity module in a project, select the arrow next to Project Settings in the Project menu on the left hand side.

Then choose the sub menu entry **Modules**.

Enable the **Activity** module and click the blue **Save** button.

![project-settings-modules](project-settings-modules.png)

### How to display the Activities of a project

The Activities from a project are displayed in the Activity module.

You can filter for different activities, e.g. for Work packages, News, or Wiki in the Filter section below the project menu.

![Activity](1567416672913.png)

### How far back can I trace the project activities?

The retrospective for the project activities is not limited. You can therefore trace all the project activities back to the beginning of the project.
You can [configure in the admin settings](../../system-admin-guide/) how many days are shown on each activity page. Due to performance reasons, the days displayed should be set at a low level (e.g. 7 days).

### Work package Activity

When you open a work package, e.g. by clicking on the ID of the work package in the work package table, you have the Activity area next to the Work package information area on the right side.

![work package activity](work-package-activity.png)


There, all changes and activities concerning the work package are documented, e.g. if a user changes the status of the work package, this activity is recorded with the information who, when and what in the Activity area and is visible for other users who have the corresponding authorization. 

You can also use the Activity area as a chat portal and share messages with other team members there.![Work package activity flag someone](Work-package-activity-flag-someone.png)



If you want to notify a specific user about something in the Activity section, you can also flag them with an "@" symbol in front of their username so that they receive a notification within OpenProject.



