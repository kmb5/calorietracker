# 03-04 · Pantry Add/Edit Form UI Implementation

**Type:** HITL
**Blocked by:** 03-02

---

## What to build

Implement the pantry add and edit item forms in React, following the approved prototype from 03-02. These forms are presented as bottom sheets, consistent with the add-to-log flow pattern in PRD 02.

This slice covers:
- **Add item bottom sheet** (triggered by "+" FAB from 03-03)
  - Name input mode toggle: free-text entry OR ingredient search (uses the shared combobox from 00-08, optional)
  - Quantity input (numeric)
  - Unit input (free-text, e.g. "g", "pieces", "can")
  - Expiry date picker (mobile-friendly `<input type="date">`)
  - Storage location selector: Fridge / Freezer / Pantry / Other (default: Pantry)
  - Notes field (optional)
  - Save calls `POST /pantry`
  - **Quick-add session**: after a successful save, the sheet remains open with fields reset (not closed), ready for the next item — a "Done" button closes the sheet
- **Edit item bottom sheet** (triggered by tapping a pantry card)
  - Pre-fills all fields from the existing item
  - Save calls `PATCH /pantry/{id}`; updates the card in the list immediately
  - "Remove item" button → confirmation → `DELETE /pantry/{id}` → undo toast

The frontend-design skill must be invoked for the visual implementation.

## Acceptance criteria

- [ ] "+" FAB opens the add item bottom sheet
- [ ] Name can be entered as free text or via the ingredient search combobox
- [ ] When an ingredient is selected from the combobox, the name field is populated
- [ ] Quantity and unit inputs are present and required
- [ ] Expiry date field uses a native date picker and is optional
- [ ] Storage location selector defaults to "Pantry"
- [ ] After saving, the sheet resets but stays open for quick-add; new item appears in the list
- [ ] "Done" button closes the sheet
- [ ] Tapping a pantry card opens the edit sheet pre-filled
- [ ] Saving the edit sheet updates the card immediately
- [ ] "Remove item" with confirmation deletes the item; undo toast appears
- [ ] Form renders correctly at 375px
- [ ] PR reviewed and approved by owner

## Blocked by

- 03-02 (approved pantry UI prototype)
