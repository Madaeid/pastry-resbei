# CV and Profile Data Integration

## Overview
Profile data and CV data are now integrated and synced together automatically!

## What's Been Implemented

### 1. **Bidirectional Data Sync**
When you save your CV, it automatically updates your profile with matching fields:
- **Full Name** (CV) → **Display Name** (Profile)
- **Date of Birth** (CV) → **Birthday** (Profile)
- **Phone** (CV) ↔ **Phone** (Profile)
- **Email** (CV) ↔ **Email** (Profile)
- **Photo** (CV) ↔ **Profile Picture** (Profile)

When you save your profile, it automatically updates your CV with matching fields:
- **Display Name** (Profile) → **Full Name** (CV)
- **Birthday** (Profile) → **Date of Birth** (CV)
- **Phone** (Profile) ↔ **Phone** (CV)
- **Email** (Profile) ↔ **Email** (CV)
- **Profile Picture** (Profile) ↔ **Photo** (CV)

### 2. **Auto-Population from Profile**
When you create your CV for the first time:
- The CV form automatically pre-fills with your profile information
- No need to re-enter data you've already provided
- Seamless experience!

### 3. **Single Source of Truth**
- All changes in one place automatically reflect in the other
- No more duplicate data entry
- Consistent information across your profile and CV

## How It Works

### Backend (Server-Side)
1. **`/api/cv` (POST)** - Saves CV and syncs to user profile
   - Updates: display_name, phone, email, birthday, profile_picture
   
2. **`/api/users/profile` (PUT)** - Saves profile and syncs to CV
   - Updates: full_name, phone, email, dob, photo

### Frontend (Client-Side)
1. **CV Edit Page** (`cv-edit.html`)
   - Loads CV data from database
   - If no CV exists, fetches profile data and pre-populates the form
   - Auto-fills name, email, phone, birthday, and photo from profile

2. **Profile Edit Modal** (`index.html`)
   - Normal profile editing continues as before
   - Changes automatically sync to CV in the background

## Usage Example

### Scenario 1: New User Creates CV
1. User creates their profile with basic info
2. User clicks "Add CV" button
3. **CV form is automatically filled** with their profile data
4. User just adds additional CV-specific info (address, skills)
5. Saves - both CV and profile are updated

### Scenario 2: User Updates Profile
1. User clicks on their profile picture to edit profile
2. Updates their phone number
3. Saves changes
4. **Phone number is automatically updated in their CV** too

### Scenario 3: User Updates CV
1. User edits their CV
2. Changes their email address
3. Saves CV
4. **Email is automatically updated in their profile** too
5. Profile picture uploads also sync between both

## Benefits
✅ **No Duplicate Entry** - Enter information once, use everywhere
✅ **Always In Sync** - Changes in one place reflect everywhere
✅ **Better UX** - Smart auto-population saves time
✅ **Data Consistency** - No conflicting information
✅ **Seamless Integration** - Works behind the scenes automatically

## Technical Details

### Database Tables
- **users** table: Stores username, display_name, email, phone, birthday, profile_picture
- **cvs** table: Stores full_name, dob, phone, email, address, skills, photo

### API Endpoints
- `GET /api/cv` - Fetch CV data
- `POST /api/cv` - Save CV (also updates profile)
- `GET /api/users/profile` - Fetch profile data
- `PUT /api/users/profile` - Save profile (also syncs to CV)

### Error Handling
- If CV doesn't exist when updating profile, the sync is gracefully skipped
- If profile fetch fails when loading CV form, falls back to session data
- All errors are logged but don't break the user experience

## Next Steps
Your CV and profile data will now stay in sync automatically. Just use the application normally!
