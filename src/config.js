// Frontend feature flags.
//
// MANUAL_UPLOAD_ENABLED — the manual Excel upload flow is RETIRED now that data flows
// automatically from Kuber (Kuber → capture → scheduled sync on the backend). The backend also
// 410s the upload write routes when MANUAL_UPLOAD_DISABLED=true. Flip this to `true` (and clear
// the backend env) only if you ever need to bring manual upload back.
export const MANUAL_UPLOAD_ENABLED = false;
