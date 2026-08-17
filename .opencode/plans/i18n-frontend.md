# Plan: Frontend i18n (Japanese/English Language Switching)

## Overview
Add Japanese/English language switching to the frontend UI (login page and dashboard) via a dropdown menu. Language preference persists in localStorage.

## Approach
Client-side JavaScript + localStorage

## Files to Change

### 1. New: `src/public/js/i18n.js`
Translation dictionary and language switching logic.

### 2. Modify: `src/views/login.ejs`
- Add `data-i18n` attributes to all text elements
- Add language switcher dropdown
- Load `i18n.js`

### 3. Modify: `src/views/dashboard.ejs`
- Add `data-i18n` attributes to all static text elements
- Add language switcher dropdown in navbar
- Replace dynamic JS text with `i18n.t()` calls
- Load `i18n.js`

## Translation Keys

### Login Page
| Key | Japanese | English |
|-----|----------|---------|
| `login.title` | Vonage Call Proxy - ログイン | Vonage Call Proxy - Login |
| `login.password_label` | パスワード | Password |
| `login.password_placeholder` | パスワードを入力 | Enter password |
| `login.submit` | ログイン | Log In |
| `login.error` | パスワードが正しくありません | Incorrect password |

### Dashboard - Static HTML
| Key | Japanese | English |
|-----|----------|---------|
| `dashboard.title` | Vonage Call Proxy - ダッシュボード | Vonage Call Proxy - Dashboard |
| `dashboard.nav_title` | 🎤 Vonage Call Proxy - ダッシュボード | 🎤 Vonage Call Proxy - Dashboard |
| `dashboard.logout` | ログアウト | Logout |
| `dashboard.call_management` | コール管理 | Call Management |
| `dashboard.destination_title` | 📞 通話先電話番号 | 📞 Destination Number |
| `dashboard.loading` | 読み込み中... | Loading... |
| `dashboard.destination_label` | 設定された通話先 | Configured destination |
| `dashboard.edit` | 編集 | Edit |
| `dashboard.destination_form_label` | 通話先電話番号を設定してください | Please set destination phone number |
| `dashboard.phone_label` | 電話番号（国際形式 +から始まる） | Phone number (international format starting with +) |
| `dashboard.phone_example` | 例: +81901234567 | Example: +81901234567 |
| `dashboard.save` | 保存 | Save |
| `dashboard.cancel` | キャンセル | Cancel |
| `dashboard.call_history` | 📋 通話履歴 | 📋 Call History |
| `dashboard.transcript_modal_title` | 📝 文字起こし | 📝 Transcript |

### Dashboard - Dynamic (JavaScript)
| Key | Japanese | English |
|-----|----------|---------|
| `dashboard.destination_form_change` | 電話番号を変更する | Change phone number |
| `dashboard.destination_load_error` | 通話先の読み込みに失敗しました: | Failed to load destination: |
| `dashboard.destination_saved` | 通話先電話番号を設定しました | Destination phone number set |
| `dashboard.destination_save_error` | 設定に失敗しました | Failed to save settings |
| `dashboard.destination_save_fail` | 通話先の設定に失敗しました: | Failed to set destination: |
| `dashboard.history_load_error` | 通話履歴の読み込みに失敗しました: | Failed to load call history: |
| `dashboard.table_date` | 日時 | Date |
| `dashboard.table_from` | 発信元 | From |
| `dashboard.table_to` | 宛先 | To |
| `dashboard.table_recording` | 録音 | Recording |
| `dashboard.table_transcript` | 文字起こし | Transcript |
| `dashboard.download` | ダウンロード | Download |
| `dashboard.transcript_view` | 💬 表示 | 💬 View |
| `dashboard.transcript_retranscribe` | 🔄 再取得 | 🔄 Retranscribe |
| `dashboard.empty_title` | 通話履歴がありません | No call history |
| `dashboard.empty_desc` | 新しい通話が記録されると、ここに表示されます | New calls will appear here when recorded |
| `dashboard.speaker_caller` | 発信者 | Caller |
| `dashboard.speaker_callee` | 着信者 | Callee |
| `dashboard.speaker_caller_initial` | 発 | C |
| `dashboard.speaker_callee_initial` | 着 | R |
| `dashboard.speakers_header_caller` | 🟦 発信者 (左側) | 🟦 Caller (Left) |
| `dashboard.speakers_header_callee` | 着信者 (右側) 🟧 | Callee (Right) 🟧 |

## Implementation Steps

### Step 1: Create `src/public/js/i18n.js`
- `translations` object with `ja` and `en` keys for all translation entries
- `I18n` class:
  - `constructor()`: Read initial language from localStorage (default: `ja`)
  - `t(key)`: Return translated string for given key
  - `setLanguage(lang)`: Set language, save to localStorage, update all `data-i18n` elements
  - `applyTranslations()`: Replace text content of all `data-i18n` elements, handle `data-i18n-placeholder` for input placeholders
  - `updateHtmlLang()`: Update `<html lang="...">` attribute
  - `updateTitle()`: Update `<title>` from `data-i18n` attribute
- Expose global `i18n` instance

### Step 2: Modify `src/views/login.ejs`
- Add `data-i18n="login.title"` to `<title>`
- Add `data-i18n="login.password_label"` to password `<label>`
- Add `data-i18n-placeholder="login.password_placeholder"` to password `<input>`
- Add `data-i18n="login.submit"` to submit `<button>`
- Add language switcher dropdown at top of login container
- Add `<script src="/js/i18n.js">` before closing `</body>`
- Update error message JS to use `i18n.t('login.error')`

### Step 3: Modify `src/views/dashboard.ejs`
- Add `data-i18n="dashboard.title"` to `<title>`
- Add language switcher dropdown in navbar (next to logout button)
- Add `data-i18n` attributes to all static text elements
- Add `<script src="/js/i18n.js">` before other scripts
- Replace all dynamic JS text with `i18n.t()` calls:
  - `loadDestination()`: error messages, label text
  - `saveDestination()`: success/error messages
  - `loadCallHistory()`: table headers, empty state messages
  - `retranscribe()`: button text
  - `showTranscript()`: speaker labels, header

### Step 4: Add dropdown CSS
- Style language select box to match existing design
- Login page: top of login container
- Dashboard: navbar right side, next to logout button

## Verification
1. Access `/login`, switch language via dropdown
2. Log in to dashboard, switch language via dropdown
3. Reload page, verify settings persist
4. Verify all text is correctly translated
5. Verify dynamic messages (errors, success) are also translated
