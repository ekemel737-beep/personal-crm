# Contact deletion

## Purpose

Remove people from the CRM: one at a time from the contact card, or several at once from the list using a delete mode with checkboxes. Interface texts are quoted in Russian, as the user sees them.

## Release condition

The app is public and has no login, so anyone who opens it could delete contacts for good. Merging to main deploys automatically, so this change MUST NOT be merged until access to the app is closed.

## Requirements

### Requirement: Deleted data is gone for good

Deleting a contact SHALL permanently remove the contact and all of its notes. Other contacts and their notes SHALL NOT change. A contact that no longer exists SHALL NOT cause an error when deleted again.

#### Scenario: Notes are removed with the contact

- **WHEN** a contact with notes is deleted
- **THEN** neither the contact nor its notes remain in the database

#### Scenario: Another browser sees the result

- **WHEN** a contact is deleted
- **THEN** it is also gone when the app is opened in another browser

### Requirement: Delete a contact from its card

The contact card SHALL have a «Удалить контакт» button below the contact details. The button SHALL open a confirmation dialog titled «Удалить контакт?» that names the contact.

#### Scenario: Cancel

- **WHEN** the dialog is closed with «Отмена» or Esc
- **THEN** the dialog closes and nothing changes

#### Scenario: Confirm

- **WHEN** «Удалить» is pressed in the dialog
- **THEN** the contact is deleted, the full list opens without that contact, the «Всего» count is one lower and the dialog is no longer on screen

#### Scenario: Old address

- **WHEN** the address of a deleted card is opened
- **THEN** the «Такой страницы нет» page is shown

#### Scenario: Browser back

- **WHEN** the browser back button is pressed after the deletion
- **THEN** the deleted card is not shown

### Requirement: Delete mode in the list

The list SHALL have a «Удалить контакты» button above the contacts. It SHALL turn on delete mode, in which every row has a checkbox. In delete mode pressing a row SHALL toggle its checkbox and SHALL NOT open the card.

#### Scenario: Nothing selected

- **WHEN** delete mode is on and no contact is selected
- **THEN** the delete button cannot be pressed

#### Scenario: Contacts selected

- **WHEN** N contacts are selected
- **THEN** the button reads «Удалить выбранные: N»

#### Scenario: Leave without deleting

- **WHEN** «Отмена» is pressed next to the delete button
- **THEN** the normal list returns, the selection is cleared and nothing is deleted

#### Scenario: Selection survives search

- **WHEN** contacts are selected and a new search is run or the search is reset
- **THEN** delete mode stays on and the selected contacts stay selected, including those not on screen

### Requirement: Confirm deletion from the list

The delete button SHALL open a confirmation dialog titled with the number of selected contacts, for example «Удалить 2 контакта?». The dialog SHALL NOT list their names.

#### Scenario: Cancel

- **WHEN** «Отмена» is pressed in the dialog
- **THEN** the dialog closes, delete mode stays on and the selection is kept

#### Scenario: Confirm

- **WHEN** «Удалить» is pressed in the dialog
- **THEN** all selected contacts are deleted, including those selected in another search, and the list returns to normal mode on the same screen
