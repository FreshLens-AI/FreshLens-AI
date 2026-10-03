# Tenant and vendor signup

A tenant is one shop's private workspace. Its owner is the **tenant admin**;
invited staff are **vendors**. Owners use the website and mobile app, vendors use
the mobile app, and platform admins review applications on the website.

## Register a shop

1. The owner opens `/signup` on the website or **Apply for a tenant account**
   on the mobile sign-in screen, then submits organization/name/email details.
2. A platform admin opens **Tenant applications** (`/applications`) and selects
   **Approve & invite**. Approval creates the tenant and owner's account, assigns
   `tenant_admin`, and sends a password-setup invitation. **Reject** creates no account.
3. The owner installs the supplied FreshLens APK before opening the invitation
   on their phone. The `freshlens://set-password` link opens **Set your password**.
4. The owner chooses and confirms a password of at least eight characters,
   then signs in. The website opens **Tenant workspace** (`/workspace`).

Submitting an application does not create a login. There is no public status
page or automatic rejection email; contact the platform admin for updates.
Use the installed APK for invitation links. For an expired link or forgotten
password, try **Forgot password?** in the app or contact the administrator.

## Invite staff

1. The owner opens **Team** (`/workspace/team`), enters the staff member's own
   name/email in **Invite a vendor**, and selects **Invite vendor**.
2. The vendor installs the APK, follows their invitation, sets a password and
   signs in to the mobile app. They join the owner's existing shop automatically.
3. The owner can **Revoke** or **Restore** vendor access from Team. A password
   reset does not restore revoked access. Platform admins can revoke whole tenants.

Staff do not submit a new-shop application. Vendors have no owner web workspace
access. If an email already belongs to an account, contact the platform admin.

## Start using the shop

- Scan newly received produce, confirm quantity and wait for the result. A
  supported completed intake creates inventory; scanning the same intake again
  can create another batch. Review failures or unknown produce before retrying.
- Select a product/batch/quantity and **Confirm Sale** to deduct stock. An oversell
  is rejected; the shop's users share the resulting inventory.
- Owners review **Stock**, **Sales**, **Analytics**, and **Team** in the workspace;
  vendors review mobile **History** and **Alerts**. Refresh to fetch current data.
- Stock deadlines are shelf-life estimates. Inspect produce physically. Sales
  charts show transactions/units, with daily reporting in Sri Lanka time.

See [authentication.md](authentication.md) for deployment configuration.
