"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import { getObject, type ObjectDef } from "./objects";
import { localInputToUtc } from "./format";

type Values = Record<string, string | number | boolean | null>;

function safePath(path: string): string {
  return path.startsWith("/") && !path.startsWith("//") ? path : "/";
}

function back(rawPath: string, error: string): never {
  const path = safePath(rawPath);
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}error=${encodeURIComponent(error)}`);
}

function mustGetObject(key: string): ObjectDef {
  const def = getObject(key);
  if (!def) throw new Error(`Unknown object: ${key}`);
  return def;
}

function parseValues(def: ObjectDef, formData: FormData): { values: Values; error?: string } {
  const values: Values = {};
  for (const field of def.fields) {
    if (field.readOnly) continue;

    if (field.type === "boolean") {
      if (formData.has(`__present_${field.name}`)) values[field.name] = formData.get(field.name) === "on";
      continue;
    }

    const raw = formData.get(field.name);
    if (raw === null) continue; // not on this form
    const v = String(raw).trim();

    if (v === "") {
      if (field.required) return { values, error: `${field.label} is required` };
      values[field.name] = null;
      continue;
    }

    switch (field.type) {
      case "number":
      case "currency":
      case "percent": {
        const n = Number(v.replace(/,/g, ""));
        if (Number.isNaN(n)) return { values, error: `${field.label} must be a number` };
        values[field.name] = n;
        break;
      }
      case "datetime": {
        const iso = localInputToUtc(v);
        if (!iso) return { values, error: `${field.label} is not a valid date/time` };
        values[field.name] = iso;
        break;
      }
      default:
        values[field.name] = v;
    }
  }
  return { values };
}

// ---------------------------------------------------------------------------
// Generic record CRUD
// ---------------------------------------------------------------------------
export async function createRecord(objectKey: string, returnTo: string, formData: FormData) {
  const def = mustGetObject(objectKey);
  const { values, error } = parseValues(def, formData);
  if (error) back(returnTo, error);

  const supabase = await createClient();
  const { data, error: dbError } = await supabase.from(def.table).insert(values).select("id").single();
  if (dbError || !data) back(returnTo, dbError?.message ?? "Could not create record");

  revalidatePath(`/${def.key}`);
  const next = String(formData.get("__next") ?? "");
  redirect(next.startsWith("/") ? next : `/${def.key}/${data.id}`);
}

export async function updateRecord(objectKey: string, id: string, formData: FormData) {
  const def = mustGetObject(objectKey);
  const returnTo = `/${def.key}/${id}/edit`;
  const { values, error } = parseValues(def, formData);
  if (error) back(returnTo, error);

  const supabase = await createClient();
  const { data, error: dbError } = await supabase.from(def.table).update(values).eq("id", id).select("id");
  if (dbError) back(returnTo, dbError.message);
  if (!data || data.length === 0) back(returnTo, "You don't have permission to edit this record");

  revalidatePath(`/${def.key}`);
  redirect(`/${def.key}/${id}`);
}

export async function deleteRecord(objectKey: string, id: string) {
  const def = mustGetObject(objectKey);
  const supabase = await createClient();
  const { data, error } = await supabase.from(def.table).delete().eq("id", id).select("id");
  if (error) back(`/${def.key}/${id}`, error.message);
  if (!data || data.length === 0) back(`/${def.key}/${id}`, "You don't have permission to delete this record");

  revalidatePath(`/${def.key}`);
  redirect(`/${def.key}`);
}

/** Path / kanban: set a single picklist field. */
export async function setFieldValue(
  objectKey: string,
  id: string,
  field: string,
  value: string
): Promise<{ error?: string }> {
  const def = mustGetObject(objectKey);
  const f = def.fields.find((x) => x.name === field);
  if (!f || f.readOnly || f.type !== "picklist" || !f.options?.some((o) => o.value === value)) {
    return { error: "Invalid field or value" };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.from(def.table).update({ [field]: value }).eq("id", id).select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "You don't have permission to edit this record" };
  revalidatePath(`/${def.key}/${id}`);
  revalidatePath("/pipeline");
  revalidatePath("/");
  return {};
}

export async function setFieldValueForm(objectKey: string, id: string, field: string, value: string) {
  const res = await setFieldValue(objectKey, id, field, value);
  if (res.error) back(`/${objectKey}/${id}`, res.error);
}

// ---------------------------------------------------------------------------
// Activities & notes on any record
// ---------------------------------------------------------------------------
export async function logActivity(objectKey: string, recordId: string, formData: FormData) {
  const def = mustGetObject(objectKey);
  const path = `/${def.key}/${recordId}`;
  const fk = def.activityKey;
  if (!fk) back(path, "Activities are not supported here");

  const subject = String(formData.get("subject") ?? "").trim();
  if (!subject) back(path, "Subject is required");

  const type = String(formData.get("type") ?? "task");
  const dueDate = String(formData.get("due_date") ?? "").trim();
  const priority = String(formData.get("priority") ?? "normal");
  const done = formData.get("completed") === "on";

  const supabase = await createClient();
  const row: Values = {
    type,
    subject,
    priority,
    due_date: dueDate || null,
    description: String(formData.get("description") ?? "").trim() || null,
    status: done ? "completed" : "not_started",
    [fk]: recordId,
  };

  // also link to the parent account when logging against a contact / opportunity / case
  if (def.key === "contacts" || def.key === "opportunities" || def.key === "cases") {
    const { data: parent } = await supabase.from(def.table).select("account_id").eq("id", recordId).single();
    if (parent?.account_id) row.account_id = parent.account_id;
  }

  const { error } = await supabase.from("activities").insert(row);
  if (error) back(path, error.message);
  revalidatePath(path);
}

export async function setActivityStatus(activityId: string, status: string, rawPath: string) {
  const path = safePath(rawPath);
  const supabase = await createClient();
  const { data, error } = await supabase.from("activities").update({ status }).eq("id", activityId).select("id");
  if (error) back(path, error.message);
  if (!data || data.length === 0) back(path, "You can only update your own activities");
  revalidatePath(path);
  revalidatePath("/");
}

export async function addNote(objectKey: string, recordId: string, formData: FormData) {
  const def = mustGetObject(objectKey);
  const path = `/${def.key}/${recordId}`;
  const fk = def.activityKey;
  if (!fk) back(path, "Notes are not supported here");
  const body = String(formData.get("body") ?? "").trim();
  if (!body) back(path, "Note text is required");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("notes").insert({
    title: String(formData.get("title") ?? "").trim() || null,
    body,
    created_by: user?.id,
    [fk]: recordId,
  });
  if (error) back(path, error.message);
  revalidatePath(path);
}

export async function deleteNote(noteId: string, rawPath: string) {
  const path = safePath(rawPath);
  const supabase = await createClient();
  const { data, error } = await supabase.from("notes").delete().eq("id", noteId).select("id");
  if (error) back(path, error.message);
  if (!data || data.length === 0) back(path, "You can only delete your own notes");
  revalidatePath(path);
}

// ---------------------------------------------------------------------------
// Opportunity products
// ---------------------------------------------------------------------------
export async function addLineItem(opportunityId: string, formData: FormData) {
  const path = `/opportunities/${opportunityId}`;
  const productId = String(formData.get("product_id") ?? "");
  const quantity = Number(formData.get("quantity") ?? 1);
  const discount = Number(formData.get("discount") || 0);
  const priceRaw = String(formData.get("unit_price") ?? "").trim();
  if (!productId) back(path, "Choose a product");
  if (!(quantity > 0)) back(path, "Quantity must be greater than zero");

  const supabase = await createClient();
  let unitPrice = Number(priceRaw);
  if (!priceRaw || Number.isNaN(unitPrice)) {
    const { data: product } = await supabase.from("products").select("unit_price").eq("id", productId).single();
    unitPrice = Number(product?.unit_price ?? 0);
  }
  const { error } = await supabase.from("opportunity_line_items").insert({
    opportunity_id: opportunityId,
    product_id: productId,
    quantity,
    unit_price: unitPrice,
    discount: Number.isNaN(discount) ? 0 : discount,
  });
  if (error) back(path, error.message);
  revalidatePath(path);
}

export async function deleteLineItem(lineItemId: string, opportunityId: string) {
  const path = `/opportunities/${opportunityId}`;
  const supabase = await createClient();
  const { data, error } = await supabase.from("opportunity_line_items").delete().eq("id", lineItemId).select("id");
  if (error) back(path, error.message);
  if (!data || data.length === 0) back(path, "You don't have permission to remove this product");
  revalidatePath(path);
}

// ---------------------------------------------------------------------------
// Campaign members
// ---------------------------------------------------------------------------
export async function addCampaignMember(campaignId: string, formData: FormData) {
  const path = `/campaigns/${campaignId}`;
  const member = String(formData.get("member") ?? ""); // "lead:<id>" or "contact:<id>"
  const [kind, id] = member.split(":");
  if (!id || (kind !== "lead" && kind !== "contact")) back(path, "Choose a lead or contact");

  const supabase = await createClient();
  const { error } = await supabase.from("campaign_members").insert({
    campaign_id: campaignId,
    [kind === "lead" ? "lead_id" : "contact_id"]: id,
    status: String(formData.get("status") ?? "sent"),
  });
  if (error) back(path, error.code === "23505" ? "Already a member of this campaign" : error.message);
  revalidatePath(path);
}

export async function setCampaignMemberStatus(memberId: string, campaignId: string, status: string) {
  const path = `/campaigns/${campaignId}`;
  const supabase = await createClient();
  const { error } = await supabase.from("campaign_members").update({ status }).eq("id", memberId);
  if (error) back(path, error.message);
  revalidatePath(path);
}

export async function removeCampaignMember(memberId: string, campaignId: string) {
  const path = `/campaigns/${campaignId}`;
  const supabase = await createClient();
  const { error } = await supabase.from("campaign_members").delete().eq("id", memberId);
  if (error) back(path, error.message);
  revalidatePath(path);
}

// ---------------------------------------------------------------------------
// Lead conversion & demo data
// ---------------------------------------------------------------------------
export async function convertLead(leadId: string, formData: FormData) {
  const path = `/leads/${leadId}/convert`;
  const accountMode = String(formData.get("account_mode") ?? "new");
  const existingAccount = String(formData.get("existing_account_id") ?? "");
  if (accountMode === "existing" && !existingAccount) back(path, "Choose an existing account");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("convert_lead", {
    p_lead_id: leadId,
    p_account_id: accountMode === "existing" ? existingAccount : null,
    p_create_opportunity: formData.get("skip_opportunity") !== "on",
    p_opportunity_name: String(formData.get("opportunity_name") ?? "").trim() || null,
  });
  if (error) back(path, error.message);

  const result = (data ?? {}) as unknown as { account_id?: string; opportunity_id?: string | null };
  revalidatePath("/leads");
  revalidatePath("/");
  redirect(result.opportunity_id ? `/opportunities/${result.opportunity_id}` : `/accounts/${result.account_id}`);
}

export async function seedDemoData() {
  const supabase = await createClient();
  const { error } = await supabase.rpc("seed_demo_data");
  if (error) back("/", error.message);
  revalidatePath("/", "layout");
  redirect("/");
}
