/**
 * Module library. Modules are defined in code; admins decide which entity gets
 * which module (ENTITY_MODULES). Column names here are the ONLY identifiers
 * that ever reach SQL — request input never names a column directly.
 *
 * Column types: string | text | int | number | date | timestamp | json | bool
 *   list:   shown in list API     sort: sortable     search: free-text search
 *   write:  client may set it      filter: allowed in ?filter[...] and filter_config
 */

const audit = { created_at: { type: 'timestamp', list: true, sort: true }, updated_at: { type: 'timestamp', sort: true } };

const S = (max, extra = {}) => ({ type: 'string', max, write: true, list: true, ...extra });

export const MODULES = {
  units: {
    table: 'units',
    createdByCol: 'created_by',
    hasUpdatedBy: true,
    title: 'Units',
    columns: {
      category: S(40, { required: true, filter: true, sort: true }),
      code: S(40, { required: true, search: true, sort: true }),
      name: S(150, { search: true, sort: true }),
      unit_type: S(60, { filter: true, sort: true }),
      floor: S(40, { filter: true, sort: true }),
      size_sqm: { type: 'number', write: true, list: true, sort: true, min: 0 },
      capacity: { type: 'int', write: true, list: true, sort: true, min: 0 },
      status: S(40, { filter: true, sort: true }),
      rent_amount: { type: 'number', write: true, list: true, sort: true, min: 0 },
      rent_period: { type: 'string', write: true, list: true, enum: ['day', 'month', 'year'] },
      tenant_contact_id: { type: 'int', write: true, list: true, ref: 'contacts' },
      lease_start: { type: 'date', write: true, list: true, sort: true },
      lease_end: { type: 'date', write: true, list: true, sort: true },
      attrs: { type: 'json', write: true, list: true },
      ...audit,
    },
    defaultSort: 'code',
  },

  leads: {
    table: 'leads',
    createdByCol: 'created_by',
    hasUpdatedBy: true,
    title: 'Leads',
    columns: {
      category: S(40, { filter: true }),
      name: S(200, { required: true, search: true, sort: true }),
      email: S(200, { search: true, format: 'email' }),
      phone: S(40, { search: true }),
      contact_id: { type: 'int', write: true, list: true, ref: 'contacts' },
      stage_id: { type: 'int', write: true, list: true, filter: true, ref: 'stages' },
      lead_source: S(40, { filter: true, sort: true }),
      value_amount: { type: 'number', write: true, list: true, sort: true, min: 0 },
      score: { type: 'int', write: true, list: true, sort: true, min: 0, max: 100 },
      assignee_id: { type: 'int', write: true, list: true, filter: true, ref: 'users' },
      quality_owner: { type: 'string', write: true, list: true, filter: true, enum: ['Marketing', 'Leasing', 'Shared'] },
      unit_id: { type: 'int', write: true, list: true, ref: 'units' },
      last_activity_at: { type: 'timestamp', list: true, sort: true },
      notes: { type: 'text', max: 4000, write: true },
      attrs: { type: 'json', write: true, list: true },
      ...audit,
    },
    defaultSort: '-created_at',
  },

  customers: {
    table: 'contacts',
    createdByCol: 'created_by',
    hasUpdatedBy: true,
    title: 'Customers',
    columns: {
      contact_type: { type: 'string', write: true, list: true, enum: ['person', 'company'] },
      name: S(200, { required: true, search: true, sort: true }),
      company: S(200, { search: true, sort: true }),
      email: S(200, { search: true, format: 'email' }),
      phone: S(40, { search: true }),
      status: S(30, { filter: true, sort: true }),
      plan: S(40, { filter: true }),
      mrr_amount: { type: 'number', write: true, list: true, sort: true, min: 0 },
      start_date: { type: 'date', write: true, list: true, sort: true },
      renewal_date: { type: 'date', write: true, list: true, sort: true },
      nps: { type: 'int', write: true, list: true, min: 0, max: 10 },
      tags: { type: 'json', write: true, list: true },
      notes: { type: 'text', max: 4000, write: true },
      attrs: { type: 'json', write: true, list: true },
      ...audit,
    },
    defaultSort: 'name',
  },

  deals: {
    table: 'deals',
    createdByCol: 'created_by',
    hasUpdatedBy: true,
    title: 'Deals',
    columns: {
      name: S(200, { required: true, search: true, sort: true }),
      lead_id: { type: 'int', write: true, list: true, ref: 'leads' },
      contact_id: { type: 'int', write: true, list: true, ref: 'contacts' },
      unit_id: { type: 'int', write: true, list: true, ref: 'units' },
      deal_type: { type: 'string', write: true, list: true, filter: true, enum: ['Lease', 'Sale', 'Service', 'MOU', 'NDA', 'Renewal', 'Other'] },
      status: { type: 'string', write: true, list: true, filter: true, sort: true, enum: ['Draft', 'Pending', 'Active', 'Won', 'Lost', 'Expired'] },
      amount: { type: 'number', write: true, list: true, sort: true, min: 0 },
      start_date: { type: 'date', write: true, list: true, sort: true },
      end_date: { type: 'date', write: true, list: true, sort: true },
      close_date: { type: 'date', write: true, list: true, sort: true },
      owner_id: { type: 'int', write: true, list: true, filter: true, ref: 'users' },
      notes: { type: 'text', max: 4000, write: true },
      attrs: { type: 'json', write: true, list: true },
      ...audit,
    },
    defaultSort: '-created_at',
  },

  activities: {
    table: 'activities',
    createdByCol: 'user_id',
    hasUpdatedBy: false,
    title: 'Activities',
    columns: {
      lead_id: { type: 'int', write: true, list: true, filter: true, ref: 'leads' },
      deal_id: { type: 'int', write: true, list: true, filter: true, ref: 'deals' },
      contact_id: { type: 'int', write: true, list: true, ref: 'contacts' },
      activity_type: { type: 'string', required: true, write: true, list: true, filter: true, enum: ['call', 'email', 'meeting', 'note', 'task', 'whatsapp', 'visit'] },
      subject: S(200, { search: true }),
      note: { type: 'text', max: 4000, write: true, list: true, search: true },
      due_at: { type: 'timestamp', write: true, list: true, sort: true },
      done: { type: 'bool', write: true, list: true, filter: true },
      user_id: { type: 'int', list: true, filter: true },
      ...audit,
    },
    defaultSort: '-created_at',
  },

  bookings: {
    table: 'bookings',
    createdByCol: 'created_by',
    hasUpdatedBy: false,
    title: 'Bookings',
    columns: {
      unit_id: { type: 'int', required: true, write: true, list: true, filter: true, ref: 'units' },
      contact_id: { type: 'int', write: true, list: true, ref: 'contacts' },
      starts_at: { type: 'timestamp', required: true, write: true, list: true, sort: true },
      ends_at: { type: 'timestamp', required: true, write: true, list: true, sort: true },
      status: { type: 'string', write: true, list: true, filter: true, enum: ['Confirmed', 'Pending', 'Cancelled', 'Completed'] },
      total_amount: { type: 'number', write: true, list: true, min: 0 },
      notes: { type: 'text', max: 2000, write: true },
      ...audit,
    },
    defaultSort: '-starts_at',
  },

  maintenance: {
    table: 'maintenance_requests',
    createdByCol: 'created_by',
    hasUpdatedBy: false,
    title: 'Maintenance',
    columns: {
      unit_id: { type: 'int', write: true, list: true, filter: true, ref: 'units' },
      contact_id: { type: 'int', write: true, list: true, ref: 'contacts' },
      request_type: S(60, { required: true, filter: true, search: true }),
      priority: { type: 'string', write: true, list: true, filter: true, sort: true, enum: ['Low', 'Medium', 'High', 'Urgent'] },
      status: { type: 'string', write: true, list: true, filter: true, sort: true, enum: ['Open', 'In Progress', 'On Hold', 'Resolved', 'Closed'] },
      assignee_id: { type: 'int', write: true, list: true, filter: true, ref: 'users' },
      notes: { type: 'text', max: 4000, write: true, list: true, search: true },
      due_at: { type: 'timestamp', write: true, list: true, sort: true },
      resolved_at: { type: 'timestamp', list: true, sort: true },
      ...audit,
    },
    defaultSort: '-created_at',
  },

  events: {
    table: 'events',
    createdByCol: 'created_by',
    hasUpdatedBy: false,
    title: 'Events',
    columns: {
      name: S(200, { required: true, search: true, sort: true }),
      event_type: S(40, { filter: true }),
      starts_at: { type: 'timestamp', required: true, write: true, list: true, sort: true },
      capacity: { type: 'int', write: true, list: true, min: 0 },
      registered: { type: 'int', write: true, list: true, min: 0 },
      status: { type: 'string', write: true, list: true, filter: true, enum: ['Upcoming', 'Ongoing', 'Completed', 'Cancelled'] },
      notes: { type: 'text', max: 2000, write: true },
      ...audit,
    },
    defaultSort: 'starts_at',
  },

  cx: {
    table: 'cx_feedback',
    createdByCol: 'created_by',
    hasUpdatedBy: false,
    title: 'Customer Experience',
    columns: {
      contact_id: { type: 'int', write: true, list: true, ref: 'contacts' },
      customer_name: S(200, { search: true, sort: true }),
      feedback_type: { type: 'string', required: true, write: true, list: true, filter: true, enum: ['NPS', 'CSAT', 'Complaint', 'Suggestion', 'Compliment'] },
      score: { type: 'int', write: true, list: true, sort: true, min: 0, max: 10 },
      comments: { type: 'text', max: 4000, write: true, list: true, search: true },
      category: S(30, { filter: true }),
      status: { type: 'string', write: true, list: true, filter: true, enum: ['Open', 'In Progress', 'Resolved'] },
      assignee_id: { type: 'int', write: true, list: true, filter: true, ref: 'users' },
      ...audit,
    },
    defaultSort: '-created_at',
  },
};

/** Modules whose screens are not plain record lists. */
export const VIEW_MODULES = {
  overview: { uses: null },
  pipeline: { uses: 'leads' },
  reports: { uses: null },
};

/** For permission checks, view modules map to the data module they read. */
export function dataModuleFor(moduleCode) {
  if (MODULES[moduleCode]) return moduleCode;
  return VIEW_MODULES[moduleCode]?.uses ?? null;
}
