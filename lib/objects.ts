/**
 * Object & field metadata — the "Setup → Object Manager" of this clone.
 * Every list view, record page, form, related list and search result is generated from these definitions,
 * so adding a column in Supabase + a FieldDef here is all it takes to surface a new field.
 */

export type ObjectKey =
  | "accounts"
  | "contacts"
  | "leads"
  | "opportunities"
  | "cases"
  | "campaigns"
  | "products"
  | "activities"
  | "users";

export type FieldType =
  | "text"
  | "textarea"
  | "email"
  | "phone"
  | "url"
  | "number"
  | "currency"
  | "percent"
  | "date"
  | "datetime"
  | "picklist"
  | "lookup"
  | "boolean";

export type Option = { value: string; label: string };

export type FieldDef = {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: Option[];
  lookup?: ObjectKey;
  readOnly?: boolean;
  section?: string;
  help?: string;
  defaultValue?: string | (() => string);
};

export type RelatedList = { object: ObjectKey; field: string; label?: string };

export type ObjectDef = {
  key: ObjectKey;
  table: string;
  label: string;
  plural: string;
  color: string;
  icon: string;
  titleFields: string[];
  sortNameField: string;
  subtitleField?: string;
  listColumns: string[];
  searchFields: string[];
  highlights: string[];
  defaultSort: { field: string; ascending: boolean };
  path?: { field: string; steps: string[] };
  related?: RelatedList[];
  /** Column on activities / notes that points at this object */
  activityKey?: string;
  canCreate?: boolean;
  canDelete?: boolean;
  hideInNav?: boolean;
  fields: FieldDef[];
};

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
export function titleCase(v: string) {
  return v
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const opts = (...values: string[]): Option[] => values.map((v) => ({ value: v, label: titleCase(v) }));
const plain = (...values: string[]): Option[] => values.map((v) => ({ value: v, label: v }));

const isoDate = (offsetDays = 0) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};

const RATING = opts("hot", "warm", "cold");
const LEAD_SOURCE = opts(
  "web",
  "phone_inquiry",
  "partner_referral",
  "employee_referral",
  "trade_show",
  "advertisement",
  "email_campaign",
  "other"
);
const INDUSTRY = plain(
  "Agriculture",
  "Banking",
  "Construction",
  "Education",
  "Energy",
  "Financial Services",
  "Government",
  "Healthcare",
  "Hospitality",
  "Insurance",
  "Logistics",
  "Manufacturing",
  "Media",
  "Retail",
  "Technology",
  "Telecommunications",
  "Other"
);
const SALUTATION = plain("Mr.", "Ms.", "Mrs.", "Dr.", "Prof.");

const system = (withOwner = true): FieldDef[] => [
  ...(withOwner
    ? [{ name: "owner_id", label: "Owner", type: "lookup", lookup: "users", section: "System" } as FieldDef]
    : []),
  { name: "created_by", label: "Created By", type: "lookup", lookup: "users", readOnly: true, section: "System" },
  { name: "created_at", label: "Created", type: "datetime", readOnly: true, section: "System" },
  { name: "updated_at", label: "Last Modified", type: "datetime", readOnly: true, section: "System" },
];

// ---------------------------------------------------------------------------
// objects
// ---------------------------------------------------------------------------
export const OBJECTS: Record<ObjectKey, ObjectDef> = {
  leads: {
    key: "leads",
    table: "leads",
    label: "Lead",
    plural: "Leads",
    color: "#f88962",
    icon: "L",
    titleFields: ["salutation", "first_name", "last_name"],
    sortNameField: "last_name",
    subtitleField: "company",
    listColumns: ["__name", "company", "status", "rating", "email", "lead_source", "owner_id"],
    searchFields: ["first_name", "last_name", "company", "email"],
    highlights: ["company", "title", "phone", "email", "owner_id"],
    defaultSort: { field: "created_at", ascending: false },
    path: { field: "status", steps: ["new", "working", "nurturing", "qualified", "converted"] },
    activityKey: "lead_id",
    fields: [
      { name: "salutation", label: "Salutation", type: "picklist", options: SALUTATION, section: "Lead Information" },
      { name: "first_name", label: "First Name", type: "text", section: "Lead Information" },
      { name: "last_name", label: "Last Name", type: "text", required: true, section: "Lead Information" },
      { name: "company", label: "Company", type: "text", required: true, section: "Lead Information" },
      { name: "title", label: "Title", type: "text", section: "Lead Information" },
      { name: "status", label: "Lead Status", type: "picklist", required: true, options: opts("new", "working", "nurturing", "qualified", "unqualified", "converted"), defaultValue: "new", section: "Lead Information" },
      { name: "email", label: "Email", type: "email", section: "Lead Information" },
      { name: "phone", label: "Phone", type: "phone", section: "Lead Information" },
      { name: "mobile", label: "Mobile", type: "phone", section: "Lead Information" },
      { name: "website", label: "Website", type: "url", section: "Lead Information" },
      { name: "rating", label: "Rating", type: "picklist", options: RATING, section: "Lead Information" },
      { name: "lead_source", label: "Lead Source", type: "picklist", options: LEAD_SOURCE, section: "Lead Information" },
      { name: "industry", label: "Industry", type: "picklist", options: INDUSTRY, section: "Lead Information" },
      { name: "annual_revenue", label: "Annual Revenue", type: "currency", section: "Lead Information" },
      { name: "employees", label: "No. of Employees", type: "number", section: "Lead Information" },
      { name: "street", label: "Street", type: "text", section: "Address" },
      { name: "city", label: "City", type: "text", section: "Address" },
      { name: "state", label: "State / Province", type: "text", section: "Address" },
      { name: "postal_code", label: "Postal Code", type: "text", section: "Address" },
      { name: "country", label: "Country", type: "text", section: "Address" },
      { name: "description", label: "Description", type: "textarea", section: "Additional Information" },
      { name: "converted_at", label: "Converted", type: "datetime", readOnly: true, section: "Conversion" },
      { name: "converted_account_id", label: "Converted Account", type: "lookup", lookup: "accounts", readOnly: true, section: "Conversion" },
      { name: "converted_contact_id", label: "Converted Contact", type: "lookup", lookup: "contacts", readOnly: true, section: "Conversion" },
      { name: "converted_opportunity_id", label: "Converted Opportunity", type: "lookup", lookup: "opportunities", readOnly: true, section: "Conversion" },
      ...system(),
    ],
  },

  accounts: {
    key: "accounts",
    table: "accounts",
    label: "Account",
    plural: "Accounts",
    color: "#5867e8",
    icon: "A",
    titleFields: ["name"],
    sortNameField: "name",
    subtitleField: "industry",
    listColumns: ["__name", "type", "industry", "phone", "billing_city", "owner_id"],
    searchFields: ["name", "website", "phone", "billing_city"],
    highlights: ["type", "phone", "website", "industry", "owner_id"],
    defaultSort: { field: "name", ascending: true },
    related: [
      { object: "contacts", field: "account_id" },
      { object: "opportunities", field: "account_id" },
      { object: "cases", field: "account_id" },
      { object: "accounts", field: "parent_account_id", label: "Child Accounts" },
    ],
    activityKey: "account_id",
    fields: [
      { name: "name", label: "Account Name", type: "text", required: true, section: "Account Information" },
      { name: "account_number", label: "Account Number", type: "text", section: "Account Information" },
      { name: "type", label: "Type", type: "picklist", options: opts("prospect", "customer", "partner", "competitor", "other"), defaultValue: "prospect", section: "Account Information" },
      { name: "industry", label: "Industry", type: "picklist", options: INDUSTRY, section: "Account Information" },
      { name: "rating", label: "Rating", type: "picklist", options: RATING, section: "Account Information" },
      { name: "parent_account_id", label: "Parent Account", type: "lookup", lookup: "accounts", section: "Account Information" },
      { name: "website", label: "Website", type: "url", section: "Account Information" },
      { name: "phone", label: "Phone", type: "phone", section: "Account Information" },
      { name: "annual_revenue", label: "Annual Revenue", type: "currency", section: "Account Information" },
      { name: "employees", label: "Employees", type: "number", section: "Account Information" },
      { name: "billing_street", label: "Billing Street", type: "text", section: "Address" },
      { name: "billing_city", label: "Billing City", type: "text", section: "Address" },
      { name: "billing_state", label: "Billing State / Province", type: "text", section: "Address" },
      { name: "billing_postal_code", label: "Billing Postal Code", type: "text", section: "Address" },
      { name: "billing_country", label: "Billing Country", type: "text", section: "Address" },
      { name: "description", label: "Description", type: "textarea", section: "Additional Information" },
      ...system(),
    ],
  },

  contacts: {
    key: "contacts",
    table: "contacts",
    label: "Contact",
    plural: "Contacts",
    color: "#a094ed",
    icon: "C",
    titleFields: ["salutation", "first_name", "last_name"],
    sortNameField: "last_name",
    subtitleField: "title",
    listColumns: ["__name", "account_id", "title", "email", "phone", "owner_id"],
    searchFields: ["first_name", "last_name", "email", "phone"],
    highlights: ["account_id", "title", "phone", "email", "owner_id"],
    defaultSort: { field: "last_name", ascending: true },
    related: [
      { object: "opportunities", field: "contact_id" },
      { object: "cases", field: "contact_id" },
      { object: "contacts", field: "reports_to_id", label: "Direct Reports" },
    ],
    activityKey: "contact_id",
    fields: [
      { name: "salutation", label: "Salutation", type: "picklist", options: SALUTATION, section: "Contact Information" },
      { name: "first_name", label: "First Name", type: "text", section: "Contact Information" },
      { name: "last_name", label: "Last Name", type: "text", required: true, section: "Contact Information" },
      { name: "account_id", label: "Account Name", type: "lookup", lookup: "accounts", section: "Contact Information" },
      { name: "title", label: "Title", type: "text", section: "Contact Information" },
      { name: "department", label: "Department", type: "text", section: "Contact Information" },
      { name: "email", label: "Email", type: "email", section: "Contact Information" },
      { name: "phone", label: "Phone", type: "phone", section: "Contact Information" },
      { name: "mobile", label: "Mobile", type: "phone", section: "Contact Information" },
      { name: "reports_to_id", label: "Reports To", type: "lookup", lookup: "contacts", section: "Contact Information" },
      { name: "lead_source", label: "Lead Source", type: "picklist", options: LEAD_SOURCE, section: "Contact Information" },
      { name: "birthdate", label: "Birthdate", type: "date", section: "Contact Information" },
      { name: "mailing_street", label: "Mailing Street", type: "text", section: "Address" },
      { name: "mailing_city", label: "Mailing City", type: "text", section: "Address" },
      { name: "mailing_state", label: "Mailing State / Province", type: "text", section: "Address" },
      { name: "mailing_postal_code", label: "Mailing Postal Code", type: "text", section: "Address" },
      { name: "mailing_country", label: "Mailing Country", type: "text", section: "Address" },
      { name: "description", label: "Description", type: "textarea", section: "Additional Information" },
      ...system(),
    ],
  },

  opportunities: {
    key: "opportunities",
    table: "opportunities",
    label: "Opportunity",
    plural: "Opportunities",
    color: "#ff5d2d",
    icon: "O",
    titleFields: ["name"],
    sortNameField: "name",
    listColumns: ["__name", "account_id", "stage", "amount", "close_date", "owner_id"],
    searchFields: ["name", "next_step"],
    highlights: ["account_id", "close_date", "amount", "probability", "owner_id"],
    defaultSort: { field: "close_date", ascending: true },
    path: {
      field: "stage",
      steps: ["prospecting", "qualification", "needs_analysis", "proposal", "negotiation", "closed_won", "closed_lost"],
    },
    activityKey: "opportunity_id",
    fields: [
      { name: "name", label: "Opportunity Name", type: "text", required: true, section: "Opportunity Information" },
      { name: "account_id", label: "Account Name", type: "lookup", lookup: "accounts", section: "Opportunity Information" },
      { name: "contact_id", label: "Primary Contact", type: "lookup", lookup: "contacts", section: "Opportunity Information" },
      { name: "stage", label: "Stage", type: "picklist", required: true, options: opts("prospecting", "qualification", "needs_analysis", "proposal", "negotiation", "closed_won", "closed_lost"), defaultValue: "prospecting", section: "Opportunity Information" },
      { name: "amount", label: "Amount", type: "currency", help: "Calculated from products when line items exist", section: "Opportunity Information" },
      { name: "probability", label: "Probability (%)", type: "percent", help: "Defaults from stage", section: "Opportunity Information" },
      { name: "close_date", label: "Close Date", type: "date", required: true, defaultValue: () => isoDate(30), section: "Opportunity Information" },
      { name: "type", label: "Type", type: "picklist", options: opts("new_business", "existing_business", "renewal"), section: "Opportunity Information" },
      { name: "lead_source", label: "Lead Source", type: "picklist", options: LEAD_SOURCE, section: "Opportunity Information" },
      { name: "next_step", label: "Next Step", type: "text", section: "Opportunity Information" },
      { name: "description", label: "Description", type: "textarea", section: "Additional Information" },
      { name: "closed_at", label: "Closed", type: "datetime", readOnly: true, section: "System" },
      ...system(),
    ],
  },

  cases: {
    key: "cases",
    table: "cases",
    label: "Case",
    plural: "Cases",
    color: "#f2cf5b",
    icon: "Cs",
    titleFields: ["subject"],
    sortNameField: "subject",
    subtitleField: "case_number",
    listColumns: ["case_number", "__name", "account_id", "status", "priority", "owner_id"],
    searchFields: ["subject", "description"],
    highlights: ["case_number", "priority", "status", "account_id", "owner_id"],
    defaultSort: { field: "created_at", ascending: false },
    path: { field: "status", steps: ["new", "working", "escalated", "closed"] },
    activityKey: "case_id",
    fields: [
      { name: "case_number", label: "Case Number", type: "text", readOnly: true, section: "Case Information" },
      { name: "subject", label: "Subject", type: "text", required: true, section: "Case Information" },
      { name: "status", label: "Status", type: "picklist", required: true, options: opts("new", "working", "escalated", "closed"), defaultValue: "new", section: "Case Information" },
      { name: "priority", label: "Priority", type: "picklist", required: true, options: opts("low", "medium", "high", "critical"), defaultValue: "medium", section: "Case Information" },
      { name: "origin", label: "Case Origin", type: "picklist", options: opts("email", "phone", "web", "chat"), section: "Case Information" },
      { name: "type", label: "Type", type: "picklist", options: plain("Question", "Problem", "Feature Request"), section: "Case Information" },
      { name: "account_id", label: "Account Name", type: "lookup", lookup: "accounts", section: "Case Information" },
      { name: "contact_id", label: "Contact Name", type: "lookup", lookup: "contacts", section: "Case Information" },
      { name: "description", label: "Description", type: "textarea", section: "Description" },
      { name: "closed_at", label: "Closed", type: "datetime", readOnly: true, section: "System" },
      ...system(),
    ],
  },

  campaigns: {
    key: "campaigns",
    table: "campaigns",
    label: "Campaign",
    plural: "Campaigns",
    color: "#f49756",
    icon: "Cp",
    titleFields: ["name"],
    sortNameField: "name",
    subtitleField: "type",
    listColumns: ["__name", "type", "status", "start_date", "end_date", "budgeted_cost", "owner_id"],
    searchFields: ["name", "description"],
    highlights: ["type", "status", "start_date", "end_date", "owner_id"],
    defaultSort: { field: "start_date", ascending: false },
    path: { field: "status", steps: ["planned", "in_progress", "completed", "aborted"] },
    fields: [
      { name: "name", label: "Campaign Name", type: "text", required: true, section: "Campaign Information" },
      { name: "type", label: "Type", type: "picklist", options: opts("email", "webinar", "conference", "advertisement", "direct_mail", "social", "other"), section: "Campaign Information" },
      { name: "status", label: "Status", type: "picklist", required: true, options: opts("planned", "in_progress", "completed", "aborted"), defaultValue: "planned", section: "Campaign Information" },
      { name: "is_active", label: "Active", type: "boolean", defaultValue: "true", section: "Campaign Information" },
      { name: "start_date", label: "Start Date", type: "date", section: "Campaign Information" },
      { name: "end_date", label: "End Date", type: "date", section: "Campaign Information" },
      { name: "budgeted_cost", label: "Budgeted Cost", type: "currency", section: "Budget" },
      { name: "actual_cost", label: "Actual Cost", type: "currency", section: "Budget" },
      { name: "expected_revenue", label: "Expected Revenue", type: "currency", section: "Budget" },
      { name: "description", label: "Description", type: "textarea", section: "Additional Information" },
      ...system(),
    ],
  },

  products: {
    key: "products",
    table: "products",
    label: "Product",
    plural: "Products",
    color: "#b781d3",
    icon: "P",
    titleFields: ["name"],
    sortNameField: "name",
    subtitleField: "product_code",
    listColumns: ["__name", "product_code", "family", "unit_price", "is_active"],
    searchFields: ["name", "product_code", "family"],
    highlights: ["product_code", "family", "unit_price", "is_active"],
    defaultSort: { field: "name", ascending: true },
    fields: [
      { name: "name", label: "Product Name", type: "text", required: true, section: "Product Information" },
      { name: "product_code", label: "Product Code", type: "text", section: "Product Information" },
      { name: "family", label: "Product Family", type: "picklist", options: plain("Software", "Services", "Support", "Training", "Hardware"), section: "Product Information" },
      { name: "unit_price", label: "List Price", type: "currency", required: true, section: "Product Information" },
      { name: "is_active", label: "Active", type: "boolean", defaultValue: "true", section: "Product Information" },
      { name: "description", label: "Description", type: "textarea", section: "Additional Information" },
      ...system(false),
    ],
  },

  activities: {
    key: "activities",
    table: "activities",
    label: "Activity",
    plural: "Activities",
    color: "#3ba755",
    icon: "T",
    titleFields: ["subject"],
    sortNameField: "subject",
    subtitleField: "type",
    listColumns: ["__name", "type", "status", "priority", "due_date", "owner_id"],
    searchFields: ["subject", "description"],
    highlights: ["type", "status", "priority", "due_date", "owner_id"],
    defaultSort: { field: "due_date", ascending: true },
    fields: [
      { name: "type", label: "Type", type: "picklist", required: true, options: opts("task", "call", "email", "meeting"), defaultValue: "task", section: "Activity Information" },
      { name: "subject", label: "Subject", type: "text", required: true, section: "Activity Information" },
      { name: "status", label: "Status", type: "picklist", required: true, options: opts("not_started", "in_progress", "completed", "deferred"), defaultValue: "not_started", section: "Activity Information" },
      { name: "priority", label: "Priority", type: "picklist", required: true, options: opts("low", "normal", "high"), defaultValue: "normal", section: "Activity Information" },
      { name: "due_date", label: "Due Date", type: "date", section: "Activity Information" },
      { name: "start_at", label: "Start", type: "datetime", section: "Activity Information" },
      { name: "end_at", label: "End", type: "datetime", section: "Activity Information" },
      { name: "location", label: "Location", type: "text", section: "Activity Information" },
      { name: "description", label: "Comments", type: "textarea", section: "Activity Information" },
      { name: "account_id", label: "Account", type: "lookup", lookup: "accounts", section: "Related To" },
      { name: "contact_id", label: "Contact", type: "lookup", lookup: "contacts", section: "Related To" },
      { name: "lead_id", label: "Lead", type: "lookup", lookup: "leads", section: "Related To" },
      { name: "opportunity_id", label: "Opportunity", type: "lookup", lookup: "opportunities", section: "Related To" },
      { name: "case_id", label: "Case", type: "lookup", lookup: "cases", section: "Related To" },
      { name: "completed_at", label: "Completed", type: "datetime", readOnly: true, section: "System" },
      ...system(),
    ],
  },

  users: {
    key: "users",
    table: "profiles",
    label: "User",
    plural: "Users",
    color: "#1b96ff",
    icon: "U",
    titleFields: ["full_name"],
    sortNameField: "full_name",
    subtitleField: "title",
    listColumns: ["__name", "email", "title", "role", "is_active"],
    searchFields: ["full_name", "email", "title"],
    highlights: ["email", "title", "role", "is_active"],
    defaultSort: { field: "full_name", ascending: true },
    canCreate: false,
    canDelete: false,
    hideInNav: true,
    fields: [
      { name: "full_name", label: "Full Name", type: "text", required: true, section: "User Information" },
      { name: "email", label: "Email", type: "email", readOnly: true, section: "User Information" },
      { name: "title", label: "Title", type: "text", section: "User Information" },
      { name: "phone", label: "Phone", type: "phone", section: "User Information" },
      { name: "role", label: "Role", type: "picklist", required: true, options: opts("admin", "manager", "sales_rep", "support_agent"), help: "Only admins can change roles", section: "User Information" },
      { name: "is_active", label: "Active", type: "boolean", section: "User Information" },
      { name: "created_at", label: "Created", type: "datetime", readOnly: true, section: "System" },
    ],
  },
};

export const NAV_OBJECTS: ObjectKey[] = [
  "leads",
  "accounts",
  "contacts",
  "opportunities",
  "cases",
  "campaigns",
  "products",
  "activities",
];

export const SEARCH_OBJECTS: ObjectKey[] = [
  "accounts",
  "contacts",
  "leads",
  "opportunities",
  "cases",
  "campaigns",
  "products",
];

export function getObject(key: string): ObjectDef | null {
  return Object.prototype.hasOwnProperty.call(OBJECTS, key) ? OBJECTS[key as ObjectKey] : null;
}

export function getField(def: ObjectDef, name: string): FieldDef | undefined {
  return def.fields.find((f) => f.name === name);
}

export const refAlias = (fieldName: string) => `ref_${fieldName}`;

/** Lookups that point back at the same table (Parent Account, Reports To) are resolved separately, see resolveSelfRefs. */
export function isSelfLookup(def: ObjectDef, f: FieldDef) {
  return f.type === "lookup" && f.lookup !== undefined && OBJECTS[f.lookup].table === def.table;
}

/** PostgREST select string: all columns + an embedded record for every lookup field. */
export function selectFor(def: ObjectDef): string {
  const joins = def.fields
    .filter((f) => f.type === "lookup" && f.lookup && !isSelfLookup(def, f))
    .map((f) => {
      const target = OBJECTS[f.lookup as ObjectKey];
      return `${refAlias(f.name)}:${target.table}!${def.table}_${f.name}_fkey(id,${target.titleFields.join(",")})`;
    });
  return ["*", ...joins].join(",");
}

type Row = Record<string, unknown>;

export function recordName(def: ObjectDef, rec: Row | null | undefined): string {
  if (!rec) return "";
  const name = def.titleFields
    .map((f) => rec[f])
    .filter((v) => v !== null && v !== undefined && v !== "")
    .join(" ");
  return name || "(no name)";
}

export function recordHref(def: ObjectDef, id: string) {
  return `/${def.key}/${id}`;
}

export function optionLabel(field: FieldDef, value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  const opt = field.options?.find((o) => o.value === String(value));
  return opt ? opt.label : titleCase(String(value));
}

export function resolveDefault(field: FieldDef): string | undefined {
  if (field.defaultValue === undefined) return undefined;
  return typeof field.defaultValue === "function" ? field.defaultValue() : field.defaultValue;
}
