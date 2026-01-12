---
description: How to edit user profiles (Self and Admin)
---

# User Profile Management

This workflow describes how to verify and use the profile editing features in the Pastry Recipe Book application.

## 1. User Self-Edit
Any logged-in user can edit their own profile.

1.  Log in to the application.
2.  Click the **Profile** (👤) tab in the main navigation bar.
3.  Modify the desired fields:
    *   **Display Name**: Visible to other users on shared recipes.
    *   **Email**: Used for password recovery.
    *   **Password**: Optional. Leave blank to keep current.
4.  Click **Save Changes**.
5.  The page will reload to reflect the updates.

## 2. Admin User Edit (Edit Any User)
Administrators can edit the profile of **any** user.

1.  Log in as an Administrator (e.g., `admin`).
2.  Navigate to the **Admin Dashboard** (click the "Dashboard" button in the header).
3.  Locate the user in the **User Management** table.
4.  Click the **Edit** (✏️) button in the user's row.
5.  A modal will appear with the user's current details.
6.  Modify the fields as needed:
    *   **Display Name**
    *   **Email**
    *   **Password** (Admin can reset user passwords directly here)
7.  Click **Save Changes**.
8.  The table will refresh with the updated information.

## 3. Verification
// turbo
1.  Check `auth.js` for the `updateUser` function.
2.  Check `admin.js` for the `handleEditUser` function.
3.  Check `main.js` for the `handleUpdateProfile` function.
