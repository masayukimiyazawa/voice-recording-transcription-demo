const translations = {
  ja: {
    'login.title': 'Vonage Call Proxy - ログイン',
    'login.password_label': 'パスワード',
    'login.password_placeholder': 'パスワードを入力',
    'login.submit': 'ログイン',
    'login.error': 'パスワードが正しくありません',

    'dashboard.title': 'Vonage Call Proxy - ダッシュボード',
    'dashboard.nav_title': '🎤 Vonage Call Proxy - ダッシュボード',
    'dashboard.logout': 'ログアウト',
    'dashboard.call_management': 'コール管理',
    'dashboard.destination_title': '📞 通話先電話番号',
    'dashboard.loading': '読み込み中...',
    'dashboard.destination_label': '設定された通話先',
    'dashboard.edit': '編集',
    'dashboard.destination_form_label': '通話先電話番号を設定してください',
    'dashboard.phone_label': '電話番号（国際形式 +から始まる）',
    'dashboard.phone_example': '例: +81901234567',
    'dashboard.save': '保存',
    'dashboard.cancel': 'キャンセル',
    'dashboard.call_history': '📋 通話履歴',
    'dashboard.transcript_modal_title': '📝 文字起こし',
    'dashboard.destination_form_change': '電話番号を変更する',
    'dashboard.destination_load_error': '通話先の読み込みに失敗しました: ',
    'dashboard.destination_saved': '通話先電話番号を設定しました',
    'dashboard.destination_save_error': '設定に失敗しました',
    'dashboard.destination_save_fail': '通話先の設定に失敗しました: ',
    'dashboard.history_load_error': '通話履歴の読み込みに失敗しました: ',
    'dashboard.table_date': '日時',
    'dashboard.table_from': '発信元',
    'dashboard.table_to': '宛先',
    'dashboard.table_recording': '録音',
    'dashboard.table_transcript': '文字起こし',
    'dashboard.download': 'ダウンロード',
    'dashboard.transcript_view': '💬 表示',
    'dashboard.transcript_retranscribe': '🔄 再取得',
    'dashboard.empty_title': '通話履歴がありません',
    'dashboard.empty_desc': '新しい通話が記録されると、ここに表示されます',
    'dashboard.speaker_caller': '発信者',
    'dashboard.speaker_callee': '着信者',
    'dashboard.speaker_caller_initial': '発',
    'dashboard.speaker_callee_initial': '着',
    'dashboard.speakers_header_caller': '🟦 発信者 (左側)',
    'dashboard.speakers_header_callee': '着信者 (右側) 🟧',
  },
  en: {
    'login.title': 'Vonage Call Proxy - Login',
    'login.password_label': 'Password',
    'login.password_placeholder': 'Enter password',
    'login.submit': 'Log In',
    'login.error': 'Incorrect password',

    'dashboard.title': 'Vonage Call Proxy - Dashboard',
    'dashboard.nav_title': '🎤 Vonage Call Proxy - Dashboard',
    'dashboard.logout': 'Logout',
    'dashboard.call_management': 'Call Management',
    'dashboard.destination_title': '📞 Destination Number',
    'dashboard.loading': 'Loading...',
    'dashboard.destination_label': 'Configured destination',
    'dashboard.edit': 'Edit',
    'dashboard.destination_form_label': 'Please set destination phone number',
    'dashboard.phone_label': 'Phone number (international format starting with +)',
    'dashboard.phone_example': 'Example: +81901234567',
    'dashboard.save': 'Save',
    'dashboard.cancel': 'Cancel',
    'dashboard.call_history': '📋 Call History',
    'dashboard.transcript_modal_title': '📝 Transcript',
    'dashboard.destination_form_change': 'Change phone number',
    'dashboard.destination_load_error': 'Failed to load destination: ',
    'dashboard.destination_saved': 'Destination phone number set',
    'dashboard.destination_save_error': 'Failed to save settings',
    'dashboard.destination_save_fail': 'Failed to set destination: ',
    'dashboard.history_load_error': 'Failed to load call history: ',
    'dashboard.table_date': 'Date',
    'dashboard.table_from': 'From',
    'dashboard.table_to': 'To',
    'dashboard.table_recording': 'Recording',
    'dashboard.table_transcript': 'Transcript',
    'dashboard.download': 'Download',
    'dashboard.transcript_view': '💬 View',
    'dashboard.transcript_retranscribe': '🔄 Retranscribe',
    'dashboard.empty_title': 'No call history',
    'dashboard.empty_desc': 'New calls will appear here when recorded',
    'dashboard.speaker_caller': 'Caller',
    'dashboard.speaker_callee': 'Callee',
    'dashboard.speaker_caller_initial': 'C',
    'dashboard.speaker_callee_initial': 'R',
    'dashboard.speakers_header_caller': '🟦 Caller (Left)',
    'dashboard.speakers_header_callee': 'Callee (Right) 🟧',
  },
};

class I18n {
  constructor() {
    this.currentLang = localStorage.getItem('language') || 'ja';
    this.applyTranslations();
  }

  t(key) {
    return translations[this.currentLang][key] || translations['ja'][key] || key;
  }

  setLanguage(lang) {
    this.currentLang = lang;
    localStorage.setItem('language', lang);
    this.applyTranslations();
  }

  applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      el.textContent = this.t(key);
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      el.placeholder = this.t(key);
    });

    this.updateHtmlLang();
    this.updateTitle();
  }

  updateHtmlLang() {
    document.documentElement.lang = this.currentLang;
  }

  updateTitle() {
    const titleEl = document.querySelector('title[data-i18n]');
    if (titleEl) {
      const key = titleEl.getAttribute('data-i18n');
      titleEl.textContent = this.t(key);
    }
  }
}

const i18n = new I18n();
