// Applies saved language/theme before first paint (no flash of wrong direction).
// External file so the Content-Security-Policy can forbid inline scripts.
try {
  var l = localStorage.getItem('cdms.locale') || 'ar';
  document.documentElement.lang = l;
  document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr';
  var t = localStorage.getItem('cdms.theme');
  if (t === 'dark' || (!t && matchMedia('(prefers-color-scheme: dark)').matches))
    document.documentElement.classList.add('dark');
} catch {
  /* storage unavailable (private mode): defaults from index.html apply */
}
