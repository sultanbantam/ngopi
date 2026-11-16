# NGOPI GREEN --- IMPLEMENTATION PROMPT FOR ANTIGRAVITY

**Project:** Ngopi.top\
**Feature:** NGOPI GREEN --- Eco Lifestyle, Environmental Intelligence &
Ngopi Points\
**Target:** Implement directly in the existing production codebase\
**Languages:** Bahasa Indonesia (`id`) and English (`en`)\
**Status target:** Working, persistent, tested feature --- NOT a mockup,
static page, demo-only UI, or disconnected mini-app.

------------------------------------------------------------------------

## 0. PRIMARY INSTRUCTION --- READ BEFORE CODING

You are working inside the existing Ngopi.top repository. The user has
provided screenshots of the live `/warkop` page and its right-side
Coffee Lounge menu. Use these screenshots as the visual and product
integration reference.

Your job is to **inspect the real codebase, understand the existing
architecture, then implement NGOPI GREEN as a fully integrated
feature**.

Do not start by generating a standalone HTML mockup. Do not invent APIs,
database tables, authentication methods, point balances, environment
variables, or framework versions. Do not assume that the production app
uses a particular ORM or database until you inspect the repository.

### Non-negotiable rules

1.  Preserve all existing Ngopi.top functionality and visual identity.
2.  Reuse the existing Ngopi authentication, user identity, profile,
    localization, database, API conventions, upload infrastructure, and
    Ngopi Points ledger wherever they exist.
3.  Never create a second user account system, a second points wallet,
    or a parallel points balance.
4.  Never award points only in frontend state/local storage. Points must
    be issued server-side through the existing points system or a
    properly integrated ledger adapter.
5.  Never show a success message until the server confirms the
    operation.
6.  Never fabricate carbon savings, tree survival, waste weights,
    verification status, or points.
7.  Every form, button, filter, tab, map control, upload, and action
    must work. If a feature cannot be completed because a real
    dependency is missing, show an honest disabled/unavailable state and
    document the blocker. Do not fake a successful workflow.
8.  Do not break existing Warkop, chat, calls, games, Ngopi Identity,
    NGOPINOMIC, ceKKes, or other modules.
9.  Use the project's existing package manager, coding conventions,
    component library, design tokens, and deployment conventions.
10. Do not expose secrets, service-role keys, private user data, or
    admin-only data to the browser.
11. Make database changes through reversible migrations. Never drop or
    rewrite existing production tables as a shortcut.
12. Work in small, verifiable phases. Run tests and build checks after
    each meaningful phase.

**Definition of done:** a signed-in user can open NGOPI GREEN from
Warkop, switch Indonesian/English, submit a real environmental activity
with evidence, see its persisted status, receive points only after valid
server-side verification, and see the same updated Ngopi Points balance
elsewhere in Ngopi. Admins can review submissions and approve/reject
them with an audit trail. All core flows persist after refresh and are
covered by tests.

------------------------------------------------------------------------

## 1. PHASE 0 --- REPOSITORY AND PRODUCTION-SAFETY AUDIT

Before changing code, inspect and report:

-   Repository root, branch, working tree status, and existing
    uncommitted changes.
-   `package.json`, lockfile, framework version, build scripts,
    lint/typecheck/test commands.
-   App routing structure and whether routes use App Router, Pages
    Router, or another structure.
-   Existing UI framework, styling system, design tokens, icons, and
    reusable components.
-   Authentication provider and the canonical server-side method for
    resolving the current user.
-   User/profile schema and stable user ID field.
-   Database provider, ORM/query layer, migration system, and current
    schema.
-   Existing Ngopi Points implementation: source of balance,
    transaction/ledger table, earning/debit APIs, idempotency, admin
    adjustments, and transaction history.
-   Existing upload/storage service, allowed file types, size limits,
    and access control.
-   Existing Indonesian/English localization implementation and locale
    persistence.
-   Existing Warkop menu/right-side drawer implementation and how its
    menu items navigate.
-   Existing role/permission model for admin/moderator.
-   Existing analytics/logging/error reporting patterns.
-   Existing environment variables by **name only**. Never print secret
    values.

Search the repository for terms such as `points`, `pts`, `kopi`,
`wallet`, `ledger`, `identity`, `locale`, `language`, `warkop`,
`upload`, `storage`, `admin`, and related equivalents.

### Required audit output

Create `docs/ngopi-green-audit.md` containing:

1.  Actual detected stack and versions.
2.  Relevant files/components/routes.
3.  Authentication integration point.
4.  Existing points balance and ledger integration point.
5.  Database and migration approach.
6.  Upload integration point.
7.  Localization approach.
8.  Warkop menu integration point.
9.  Risks and constraints.
10. Exact implementation plan based on the repository.

Do not stop after writing the audit. Continue to implementation unless a
genuine blocker prevents safe progress. If blocked, explain the exact
missing dependency and implement the parts that can safely be completed.

------------------------------------------------------------------------

## 2. PRODUCT AND NAVIGATION

Create the feature under the existing application namespace:

-   Main route: `/green`
-   Dashboard: `/green/dashboard` (or the project's equivalent nested
    route convention)
-   Activities: `/green/activities`
-   Activity detail/form routes as appropriate.
-   Environmental map: `/green/map`
-   Challenges: `/green/challenges`
-   Community: `/green/community`
-   Leaderboard: `/green/leaderboard`
-   Impact: `/green/impact`
-   Rewards: `/green/rewards`
-   History: `/green/history`
-   Education: `/green/education`
-   Admin: `/green/admin` (protected by actual server-side role checks).

If the repository uses a different route convention, follow it while
preserving the user-facing `/green` entry point.

### Warkop integration

Add a new item in the existing Coffee Lounge / Warkop additional menu:

-   **Bahasa Indonesia:** `NGOPI GREEN`
-   **English:** `NGOPI GREEN`
-   Short Indonesian description:
    `Gaya hidup ramah lingkungan, aksi nyata, dampak terukur, dan reward poin.`
-   Short English description:
    `Eco-friendly lifestyle, verified actions, measurable impact, and points rewards.`
-   Icon: use an existing icon package already installed; preferred
    concept is leaf/sprout.
-   Status label: do not claim "LIVE" until the route and core APIs
    work.

Also consider a compact shortcut in the existing Warkop action chips
only if it fits the current UI without crowding. Do not redesign the
entire Warkop page.

### UI/UX reference

Follow the supplied screenshots:

-   Dark coffee-inspired background.
-   Existing brown/gold/orange accent palette.
-   Rounded cards and subtle borders.
-   Existing typography, spacing, buttons, badges, and hover/focus
    states.
-   Consistent desktop and mobile behavior.
-   Reuse existing layout shell and header where appropriate.
-   Avoid a visually unrelated green-themed microsite. Green may be used
    as a semantic accent for environmental status, but it must still
    look like Ngopi.

Build real loading, empty, error, success, and permission-denied states.

------------------------------------------------------------------------

## 3. BILINGUAL REQUIREMENTS (ID / EN)

All user-facing text must be translated:

-   Navigation and labels.
-   Category descriptions.
-   Form labels, placeholders, validation messages.
-   Upload instructions.
-   Submission statuses.
-   Verification reasons.
-   Carbon/impact explanations and units.
-   Points explanations.
-   Challenges, leaderboard, rewards.
-   Admin actions and audit information.
-   Empty/loading/error states.
-   Email/in-app notifications if this feature sends them.

Use the existing i18n solution. Do not create a separate language
switcher if Ngopi already has one. The existing `EN | id` control should
apply to NGOPI GREEN too.

If no localization infrastructure exists, implement a small maintainable
translation dictionary using the project's conventions and persist the
selected locale consistently. Do not hardcode language conditionals
throughout components.

Default locale should follow the existing Ngopi user preference/browser
behavior. Preserve the current user's locale choice.

------------------------------------------------------------------------

## 4. SEVEN ENVIRONMENTAL ACTIVITY CATEGORIES

Implement all seven categories as actual data-driven activity types.
Store category metadata in a maintainable seed/configuration mechanism,
not duplicated UI conditionals.

### 4.1 Green Mobility --- Transportasi Ramah Lingkungan

Support activity modes including:

-   Angkot / city minibus.
-   Angkutan desa / rural transport.
-   City bus, BRT, TransJakarta and other bus rapid transit.
-   Intercity bus, shuttle, airport bus, school bus, employee bus.
-   KRL/commuter rail, MRT, LRT, airport rail, intercity train, local
    train.
-   Passenger ferry, inter-island ferry, pioneer vessel, passenger ship,
    river boat, waterbus.
-   Domestic and international flights, including connecting flights
    where relevant.
-   Ojek, motorcycle taxi, app-based motorcycle taxi.
-   Taxi and app-based taxi.
-   Shared ride / carpool.
-   Private car and private motorcycle (record actual emissions; do not
    automatically reward as green).
-   Electric car, electric motorcycle, electric bus.
-   Bicycle, e-bike, walking.
-   Pedicab/becak, electric becak, bajaj, bemo, delman/horse cart where
    locally relevant.
-   Other modes with a controlled `other` value and required
    description.

Required fields, conditionally shown by mode:

-   Mode of transport.
-   Origin and destination or distance.
-   Distance in km (required if no reliable route calculation exists).
-   Passenger count / shared ride occupancy where relevant.
-   Vehicle/fuel/powertrain class if applicable.
-   Date and optional time.
-   Optional supporting evidence.
-   Whether this trip replaced a private motorized trip, where the user
    can reasonably answer.

Rules: - Walking/cycling points must be based on reasonable distance
and/or a documented daily cap. - Public transport points must use a
baseline comparison and actual mode-specific emission factor when
available. - Ride-hailing, taxi, private vehicles, and flights must not
automatically earn "green" points simply because the trip was
recorded. - Record actual emissions and estimated avoided emissions
separately. - Do not assume every public transport trip avoided a
private car trip. Make baseline assumptions explicit and configurable.

### 4.2 Eco Waste --- Waste Sorting & Ecobrick

Support: - Ecobrick creation. - Plastic collection and sorting. - PET,
HDPE, LDPE, PP, PS, PVC, multilayer/sachet packaging, and other
identifiable types. - Delivery to an authorized recycling facility or
bank sampah. - Reuse/upcycling. - Organic waste composting. - Food
scraps managed by a suitable organic waste process. - Used cooking oil
collection through a proper partner. - E-waste collection through an
authorized handler. - Community clean-up events.

Bottle/container size options must be configurable and include at
least: - 220 ml, 240 ml, 330 ml, 350 ml, 500 ml, 600 ml, 750 ml, - 1,000
ml, 1,500 ml, 2,000 ml, - 5 L, 10 L, and 19 L gallon, - Other container
with custom capacity.

Important: - Container volume is not a substitute for actual plastic
mass. - Ecobrick submission must capture actual measured plastic weight
in grams, bottle capacity, material type, and evidence. - Provide a
configurable quality standard. If using the commonly referenced 0.33
g/ml density criterion, label it as a configurable guideline and cite
the applicable source in the product's education/reference page; do not
represent it as a universal legal standard. - Do not allow paper, glass,
metal, organic waste, or hazardous waste to be marked as ecobrick
filler. - Do not reward the same plastic mass twice across ecobrick,
recycling, and collection activities. Use unique submission/evidence
checks and a duplicate prevention workflow. - Distinguish collected
waste from waste actually delivered/processed.

### 4.3 Zero Food Waste --- Food & Beverage Waste Reduction

Support: - Finishing a meal without avoidable leftovers. - Taking only
the portion needed. - Saving/donating safe edible surplus food. - Food
sharing. - Reusable food containers. - Reducing single-use food
packaging. - Buying local/seasonal food (educational/behavioral
tracking; do not invent carbon benefit). - Composting unavoidable food
scraps. - Appropriate organic waste processing, including suitable BSF
programs. - Household, restaurant, hotel, event, and community food
waste reduction.

Required fields should be proportional to the activity: - Activity
type. - Number of portions or food mass (grams/kg), where measurable. -
Whether the food was saved, donated, consumed, or composted. -
Date/location where relevant. - Evidence only where it adds verification
value.

Do not award points merely for a photo of an empty plate. Reward
measurable or credible waste prevention, food rescue, or correct organic
waste processing. Never encourage overeating. User safety and food
hygiene take priority.

### 4.4 Green Planting --- Tree & Plant Planting

Support categories/examples: - Rare/endemic/native species. - Fruit
trees. - Timber/conservation trees. - Coastal/mangrove species where
ecologically appropriate. - Bamboo species (including local species). -
Food plants and agroforestry. - Medicinal plants. - Pollinator-friendly
native plants. - Riparian and erosion-control vegetation. - Home/urban
garden plants. - Other plants with species identification.

Examples may include ulin, cendana, eboni, meranti, damar, trembesi,
beringin, puspa, mangga, durian, rambutan, manggis, alpukat, nangka,
jambu, mangrove species, ketapang, cemara laut, vetiver, and bamboo
species. These are examples, not a blanket recommendation for every
location.

Required fields: - Common name and scientific name if known. - Species
group. - Quantity. - Seedling/source information if available. -
Planting date. - GPS/location with user consent. - Land/ecosystem
type. - Photo evidence. - Whether planting is individual, community, or
institutional. - Follow-up monitoring schedule.

Do not recommend planting a species in an unsuitable ecosystem. Include
a warning to use locally appropriate native species and obtain
landowner/authority permission.

Points: - Planting points are behavior rewards, not an immediate
carbon-credit claim. - Award initial points only after verified
planting. - Add survival/maintenance milestones only after later
evidence. - Do not count a dead plant as a living tree or as ongoing
carbon sequestration.

### 4.5 Green Care --- Tree & Plant Care

Support: - Watering. - Mulching and soil improvement. - Organic
fertilization. - Weed management. - Pruning dead/dangerous branches by
qualified people. - Pest/disease monitoring and safe treatment. - Tree
health monitoring. - Bamboo grove maintenance. - Mangrove/urban
forest/park/riparian restoration maintenance. - Plant recovery and
replacement.

Required fields: - Plant/tree reference if registered, otherwise
create/link a plant record. - Care action. - Number of plants. - Date
and duration. - Optional material/water quantity. - Before/after
evidence when appropriate. - Notes and observed health status.

Prevent repetitive low-value point farming. Use per-plant/per-period
caps and require meaningful evidence. Hazardous tree work must be
restricted to qualified personnel and must not encourage users to climb
or cut dangerous trees.

### 4.6 Eco Intelligence --- Environmental Database & Reports

Create a geospatial environmental reporting system. Categories include:

**Trees and vegetation** - Dangerous/unstable trees, fallen trees, dead
trees, diseased trees, rare trees, damaged green spaces.

**Water and flooding** - Flood locations, standing water, tidal
flooding/rob, blocked drains, damaged drainage, polluted rivers/lakes,
water leaks.

**Infrastructure** - Potholes, damaged roads, damaged bridges, damaged
sidewalks, broken streetlights, damaged public facilities.

**Waste and pollution** - Illegal dumping, illegal waste sites, waste
burning, industrial discharge, smoke, excessive dust, odor pollution,
river/sea pollution, oil spills.

**Fire and land** - Fire hotspots, land/forest fires, smoke plumes,
erosion, landslides, degraded land, soil pollution.

**Transport and public space** - Traffic congestion, unsafe pedestrian
areas, broken bicycle lanes, illegal parking, accident-prone locations.

**Biodiversity and coastal** - Injured wildlife, wildlife sightings
where safe, habitat destruction, invasive species, coastal abrasion,
damaged mangroves, marine litter, coral damage.

Required report fields: - Category and subcategory. - Short title and
description. - Location/map pin, with consent and privacy controls. -
Report time. - Photo/video evidence subject to existing upload policy. -
Severity/urgency selected by user (not treated as confirmed fact). -
Optional anonymous/public display setting, subject to moderation. -
Duplicate/related report reference when detected.

Required statuses: - Submitted. - Under review. - Verified. - Rejected
(with reason). - Referred to responsible party. - In progress. -
Resolved. - Closed.

Points: - A valid report may earn points only after
moderation/verification. - Additional follow-up points may be granted
when a report produces a verified outcome, with strict limits. -
Duplicate, malicious, misleading, unsafe, or unsubstantiated reports
must not earn points. - Never publish sensitive personal data, private
property details, or exact endangered-species locations publicly. -
Provide a clear emergency disclaimer: NGOPI GREEN is not an emergency
response service. Direct imminent danger to local emergency/official
channels.

Map: - Use the map technology already present in the repository if
available. - If none exists, choose a maintainable map provider only
after checking licensing, API-key requirements, usage limits, and
deployment environment. Keep provider keys server-side where required. -
Map must support category filters, report status, clustering/pagination,
and a detail view. - Do not display all private report coordinates to
the public.

### 4.7 Energy & Water Saving --- Energy and Water Conservation

Support: - Turning off lights/electrical equipment when not needed. -
Efficient AC use and thermostat settings. - LED replacement. -
Unplugging idle chargers/devices where safe. - Efficient appliances. -
Solar/renewable energy adoption (record installation/usage
separately). - Turning off taps. - Repairing leaks. - Rainwater
harvesting. - Safe reuse of greywater. - Water-efficient
washing/cleaning. - Other measurable conservation actions.

Required measurement: - Electricity saved in kWh, or device wattage ×
credible unused hours where appropriate. - Water saved in liters where
measurable. - Baseline and measurement method. - Date and evidence when
relevant.

Do not invent savings from a simple checkbox such as "I turned off a
light." If exact measurement is unavailable, record it as a behavioral
action and award a modest behavior reward under a daily cap, while
carbon impact remains unquantified or clearly estimated.

------------------------------------------------------------------------

## 5. CARBON ACCOUNTING --- SEPARATE IMPACT FROM REWARD POINTS

Build a transparent, versioned calculation engine. Never use one
universal carbon factor for all activities.

### Required separate metrics

1.  `actual_emissions_kgco2e`: estimated actual emissions associated
    with the activity.
2.  `baseline_emissions_kgco2e`: emissions under a documented comparison
    scenario.
3.  `avoided_emissions_kgco2e`: baseline minus actual, only where the
    baseline is justified.
4.  `sequestered_carbon_kgco2e`: only when a defensible methodology and
    time horizon exist.
5.  `waste_prevented_kg`: measured/prevented waste mass.
6.  `water_saved_liters`: measured or explicitly estimated.
7.  `energy_saved_kwh`: measured or explicitly estimated.
8.  `biodiversity/ecosystem indicators`: counts/status, not
    automatically converted into CO2e.

Each impact record must include: - Metric name and value. - Unit. -
Calculation method/formula identifier. - Input values. -
Emission-factor/reference ID and version. - Geographic applicability. -
Data quality/confidence level. - Whether measured, calculated, or
estimated. - Timestamp. - Reviewer/verification state where applicable.

### Calculation principles

-   Use authoritative, current, regionally appropriate emission factors
    where available.
-   Prefer Indonesian government/recognized datasets and credible
    published methodologies for Indonesia.
-   Do not silently import a foreign factor as an Indonesia-specific
    factor.
-   If no suitable factor exists, return `not_calculated` or a clearly
    labeled provisional estimate; do not fabricate precision.
-   Keep all factors editable/versioned by authorized administrators.
-   Preserve the factor and method version used for historical records.
-   Avoid double counting across activities and across external
    programs.
-   For trees, do not claim immediate sequestration at planting. Track
    survival and growth; only calculate carbon using a disclosed
    species/biomass methodology, time horizon, and uncertainty.
-   For transport, document baseline mode, occupancy, distance,
    fuel/energy type, and assumptions.
-   For electricity, use relevant grid emission factor by region/year if
    available.
-   For waste, distinguish collection, reuse, recycling, composting, and
    final treatment. Do not assume all collected waste is recycled.
-   Display `estimated` wherever estimates are used.

### Carbon calculation output example

Show a transparent explanation such as:

-   Distance: 8 km.
-   Selected mode: commuter train.
-   Comparison baseline: private motorcycle (only if user
    selected/confirmed the comparison).
-   Actual emissions: calculated using the configured factor.
-   Avoided emissions: baseline minus actual.
-   Method/version: visible in detail.

Do not hardcode sample numbers as real user impact.

------------------------------------------------------------------------

## 6. NGOPI POINTS INTEGRATION --- CRITICAL

First inspect the actual existing Ngopi Points mechanism. The
screenshots show a points balance in Warkop and existing activities such
as riddle rewards and cafe check-in. Reuse the same canonical
balance/ledger.

### Required behavior

-   NGOPI GREEN must credit the existing Ngopi Points account.
-   Existing Warkop points display must reflect the updated balance
    using the existing refresh/realtime mechanism.
-   Points earned must appear in the existing transaction/history
    mechanism if available.
-   Do not create a second points balance or a parallel wallet.
-   Never let the browser submit an arbitrary points amount to credit.
-   Server calculates the eligible reward from approved rules and
    verified activity.
-   All reward issuance must be idempotent: repeated approval, retry,
    webhook, or page refresh must never double-credit.
-   Use a unique reference to link a points transaction to a green
    submission.
-   Use database transaction/atomic operation where supported.
-   Log every reward issuance, reversal, adjustment, and rejection.
-   Reversal must be an auditable compensating transaction, not silent
    deletion.
-   Admin cannot change point rules without permission and audit
    history.

### Reward rule configuration

Store reward rules in database/config with: - Activity type/subtype. -
Base points. - Unit and conversion. - Maximum points per submission. -
Daily/weekly/monthly caps. - Verification requirement. - Evidence
requirement. - Effective date and rule version. - Enabled/disabled
state. - Admin actor and audit trail.

Use sensible configurable starting values only after confirming the
existing point economy and abuse controls. Treat any proposed values
below as **initial configuration suggestions**, not environmental
equivalencies:

  -----------------------------------------------------------------------
  Activity                                      Suggested starting reward
  ------------------------------ ----------------------------------------
  Walking/cycling                                  2 points/km, daily cap

  Public transport                    1--5 points/trip, based on mode and
                                                             verification

  Carpool                          2--5 points/trip, subject to occupancy
                                                             and baseline

  Ecobrick                         1 point/100 g verified plastic, capped

  Waste delivered to approved                   1 point/100 g, capped and
  facility                                              duplicate-checked

  Food waste prevented             1 point/100 g, or approved per-portion
                                                                     rule

  Safe food rescue/donation      5 points/portion after partner/recipient
                                                               validation

  Tree planting                        10--50 points/plant after planting
                                                             verification

  Conservation/rare native plant       20--100 points only under approved
                                                species/location criteria

  Plant care                          2--10 points/session with per-plant
                                                             periodic cap

  Verified environmental report                       5--20 points/report

  Report with verified               5--30 additional points under strict
  resolution                                                        rules

  Electricity saving                       2 points/kWh measured/verified

  Water saving                            1 point/100 L measured/verified
  -----------------------------------------------------------------------

If the existing Ngopi Points system uses different units, limits, or
rules, adapt to the canonical system and document the mapping.

### Points and other metrics must remain distinct

-   Ngopi Points: internal loyalty/reward points.
-   Eco Score: reputation/progress metric based on verified
    contributions.
-   Carbon Impact: kg CO2e or other environmental metrics.
-   BMC: separate cross-ecosystem utility token. Do not convert Ngopi
    Points to BMC or claim interchangeability unless an explicit
    approved integration already exists.

Do not promise cash value, tradability, investment return, or guaranteed
redemption.

------------------------------------------------------------------------

## 7. USER EXPERIENCE AND PAGES

### 7.1 Dashboard `/green`

Show real data for the signed-in user: - Ngopi Points balance from
canonical points source. - Pending/verified/rejected activity counts. -
Estimated CO2e avoided (only verified/calculated records). - Waste
managed/prevented (with category distinction). - Plants planted and
survival status. - Water/energy savings where measured. - Recent
activities. - Active challenges. - Quick action cards for all seven
categories. - Progress/level based on verified contribution points. -
Explanation of estimates and data confidence.

No fabricated demo stats. For a new account, show zero/empty state and a
clear first-action CTA.

### 7.2 Activity submission

Create a reusable, accessible form framework: - Category and subtype. -
Dynamic fields for selected subtype. - Date/time. - Quantity/unit. -
Location only when necessary and with permission. - Evidence upload via
existing secure upload service. - Notes. - Consent/accuracy
confirmation. - Client-side validation plus authoritative server-side
validation. - Submission review screen. - Server response with
submission ID and status.

Uploads: - Validate MIME type and file size server-side. - Use
signed/private storage where appropriate. - Avoid public exposure of
sensitive evidence. - Restrict file types to safe image/document/video
formats supported by the existing system. - Add malware scanning if
available in the existing infrastructure. - Never trust filename or
client-provided MIME alone.

### 7.3 Activity history

Filters: - Category. - Status. - Date range. - Points earned. - Impact
metric. - Pagination.

Each record detail must show submitted evidence (authorized user only),
verification notes, point transaction reference, impact calculation and
factor version.

### 7.4 Eco profile

Show: - Eco level and verified points progress. - Activity streak only
if based on actual dated submissions. - Verified contribution
statistics. - Badges earned from deterministic rules. - Public/private
visibility settings. - Share card only after data is retrieved from the
server; do not leak private location/evidence.

### 7.5 Challenges and community

Implement real challenge records and membership: - Challenge
title/description in ID and EN. - Start/end date. - Target metric and
target quantity. - Eligibility and reward rules. - Participant progress
based on verified activity records. - Community/group challenges where
existing Ngopi groups can be integrated safely. - Leaderboard
opt-in/privacy settings. - Anti-cheat rules and challenge audit history.

### 7.6 Rewards

Show only rewards that are actually configured and available: - Partner
voucher/reward catalog. - Required points. -
Stock/validity/eligibility. - Redemption request and status. -
Server-side deduction/reservation through existing points ledger if
redemption is supported. - Do not display fake partners, fake vouchers,
or buttons that cannot redeem.

If no real reward partner/catalog exists yet, implement a truthful
"coming soon / no rewards configured" state and an admin-managed catalog
schema; do not fake redemption.

### 7.7 Education and references

Create concise educational content in ID/EN: - How to record each
activity correctly. - What counts as evidence. - Difference between
carbon avoided, emitted, and sequestered. - Why tree planting is not
instant carbon offset. - Ecobrick limitations and safe handling. - Waste
sorting and proper disposal. - Safety guidance. - Methodology and
emission-factor references with publication/version dates.

Do not present NGOPI GREEN as a certified carbon-credit registry or
carbon offset marketplace.

------------------------------------------------------------------------

## 8. ADMIN / MODERATION

Implement protected admin screens using existing authorization roles.
Never rely on hiding a button in the UI as access control.

Admin capabilities: - Submission queue with filters. - Evidence
review. - Approve/reject with required reason. - Mark
needs-more-information if supported. - View duplicate warnings and risk
signals. - View calculation inputs and factor version. - Approve/reject
environmental reports. - Manage plant species/reference catalog. -
Manage emission factors and versions. - Manage reward rules and caps. -
Manage challenges and reward catalog. - View points ledger references. -
View audit logs. - Export permitted aggregate reports (CSV if existing
stack supports it).

Every privileged action must be checked server-side and recorded: -
Actor ID. - Action. - Target record. - Before/after values where
appropriate. - Timestamp. - Reason. - Request/correlation ID where
available.

Never allow an admin action to silently overwrite historical carbon
calculation records or points transactions.

------------------------------------------------------------------------

## 9. DATABASE DESIGN --- ADAPT TO THE REAL EXISTING DATABASE

Do not assume table names or database provider. Design migrations
consistent with the existing schema. Use existing users and points
tables; reference their canonical IDs.

Suggested logical entities (adapt naming/types/relations):

1.  `green_activity_categories`
2.  `green_activity_types`
3.  `green_submissions`
4.  `green_evidence`
5.  `green_verifications`
6.  `green_emission_factors`
7.  `green_impact_records`
8.  `green_reward_rules`
9.  Existing canonical Ngopi points ledger reference (do not create a
    new wallet).
10. `green_environment_reports`
11. `green_plants`
12. `green_plant_monitoring`
13. `green_challenges`
14. `green_challenge_members`
15. `green_rewards`
16. `green_redemptions` (only if actual redemption is supported)
17. `green_audit_logs`

### Data integrity requirements

-   Foreign keys to existing user IDs.
-   Appropriate indexes for user, category, status, date,
    location/geospatial query.
-   Unique idempotency key for point issuance per eligible
    submission/rule.
-   Server-generated IDs.
-   Timestamps and status transition rules.
-   Soft-delete only where appropriate; preserve auditability.
-   Database constraints for nonnegative quantities and valid status
    enums/checks.
-   Store units explicitly.
-   Store numeric values using suitable decimal precision, not
    floating-point for financial/ledger values.
-   Store calculation method and factor versions for reproducibility.
-   Avoid storing unnecessary sensitive location or personal data.
-   Apply retention/access policies consistent with existing privacy
    rules.

### Migration discipline

-   Create additive migrations.
-   Back up or verify backup process before production migration.
-   Never drop existing tables/columns.
-   Run migration locally/staging first if available.
-   Include rollback instructions where supported.
-   Seed category and translation data idempotently.
-   Never seed fake user submissions or fake points.

------------------------------------------------------------------------

## 10. SECURITY, PRIVACY, FRAUD AND SAFETY

Implement: - Authentication on all personal endpoints. - Server-side
ownership checks. - Server-side admin role checks. - CSRF protection
where applicable. - Input validation and output encoding. - Rate
limiting for submissions, uploads, reports, and reward claims. - Upload
size/type validation. - Duplicate evidence detection using file
hash/perceptual hash if available. - Idempotent submission/reward
processing. - Abuse monitoring and audit logs. - Protection against user
enumeration and IDOR. - Privacy controls for GPS and public profile. -
Consent for location/photo usage. - Safe handling of minors and
identifiable people in uploaded photos. - Clear user reporting/appeal
process. - Moderation for public environmental reports. - No exact
public display of sensitive biodiversity or private addresses. - No
unsafe instructions for handling fires, power lines, hazardous waste,
dangerous trees, floods, or polluted water.

Do not use GPS or image AI as sole proof of a high-value reward. Use
risk-based human review where needed.

------------------------------------------------------------------------

## 11. AI INTEGRATION --- ONLY IF REAL AND AVAILABLE

AI features are optional enhancements; core activity recording, points,
and impact calculations must work without AI.

Potential integrations: - Plant/species image assistance. -
Waste/material image classification. - Duplicate image detection. -
Environmental report classification and prioritization. -
Natural-language activity assistant in ID/EN. - Photo quality checks.

Before implementing: 1. Inspect existing AI providers and environment
configuration. 2. Reuse existing AI infrastructure where possible. 3.
Keep provider keys server-side. 4. Add timeout, rate limit, retry and
fallback. 5. Clearly label AI output as suggestion, not authoritative
verification. 6. Never let AI alone approve a high-value points
transaction. 7. Do not add a paid external service without documenting
cost, credentials, and user approval requirements.

If no AI service is configured, implement a provider interface and a
functional manual workflow. Do not return hardcoded fake AI
classifications.

------------------------------------------------------------------------

## 12. API AND SERVICE LAYER

Follow existing API route conventions. Suggested logical operations:

-   Read dashboard and profile.
-   Read category/type metadata.
-   Create activity submission.
-   Upload evidence using existing storage flow.
-   Read own activity history/detail.
-   Read own impact summary.
-   Read leaderboard with privacy filters.
-   Read/create/join challenges.
-   Read reward catalog and request redemption if supported.
-   Create environmental report.
-   Read public-safe environmental map data.
-   Create/update plant record and monitoring.
-   Admin review/approve/reject submissions.
-   Admin manage reward rules, emission factors, challenges and
    reference data.

Every endpoint must: - Validate input schema. - Authenticate user. -
Enforce ownership/role. - Apply rate limits. - Return consistent error
format. - Log safely without logging secrets or private evidence URLs. -
Use server-side transactions for coupled operations. - Have tests for
unauthorized and invalid requests.

Do not blindly create endpoints with the exact sample names if the
codebase uses another convention. Integrate into the actual API
structure.

------------------------------------------------------------------------

## 13. TESTING AND ACCEPTANCE CRITERIA

Write tests using the existing test framework. At minimum cover:

### Authentication and access

-   Anonymous user cannot submit or access personal data.
-   User A cannot read User B's private submission/evidence.
-   Non-admin cannot access admin actions.
-   Admin permissions are checked server-side.

### Submission

-   Valid activity can be submitted and persists after refresh.
-   Invalid units/negative quantities are rejected.
-   Missing required evidence is rejected where applicable.
-   Unsupported activity type is rejected.
-   Duplicate evidence is flagged/blocked according to policy.

### Points

-   Pending submission does not earn points.
-   Approved eligible submission earns points exactly once.
-   Repeated approval/retry does not double-credit.
-   Rejected submission earns no points.
-   Reversal creates an auditable compensating transaction.
-   Existing Warkop balance reflects Green rewards from the canonical
    points source.
-   Frontend cannot choose its own reward amount.

### Carbon accounting

-   Known test inputs produce expected results under the configured
    factor.
-   Missing factor does not produce invented CO2e.
-   Factor version is retained on historical records.
-   Avoided emissions cannot be negative and silently represented as a
    benefit.
-   Tree planting does not create instant sequestration claims.
-   Estimated vs measured values are distinguishable.

### Localization and UI

-   All NGOPI GREEN visible strings are translated.
-   Existing locale selector controls the feature.
-   Desktop and mobile layouts work.
-   Loading, empty, error, success, and permission states are tested.
-   No dead buttons or fake links.

### Regression

-   Existing Warkop page loads.
-   Existing points display still works.
-   Existing riddle/cafe check-in reward flows are not broken.
-   Existing authentication and navigation are unchanged.
-   Run lint, typecheck, unit tests, integration tests and production
    build.

------------------------------------------------------------------------

## 14. IMPLEMENTATION ORDER --- EXECUTE IN THIS ORDER

Do not attempt to implement every advanced feature in one untested
change.

### Phase A --- Audit and integration foundation

-   Complete repository audit.
-   Identify canonical auth, points, upload, localization, menu, and DB.
-   Write audit document.
-   Add feature route and Warkop menu entry.
-   Add bilingual shell and dashboard empty states.
-   Confirm no regression.

### Phase B --- Working activity submission

-   Implement category/type metadata for all seven categories.
-   Implement dynamic forms and validation.
-   Implement secure evidence upload.
-   Persist submissions and history.
-   Add user-facing statuses.
-   Test persistence and access controls.

### Phase C --- Verification and real points

-   Implement admin review queue.
-   Implement approve/reject workflow.
-   Connect approved submissions to existing Ngopi Points ledger.
-   Add idempotency, caps, audit trail, and balance refresh.
-   Test no duplicate credit and no cross-user access.

### Phase D --- Impact engine

-   Implement versioned factors and transparent formulas.
-   Calculate only supported metrics.
-   Distinguish actual, baseline, avoided, and sequestered emissions.
-   Add impact dashboard with source/method disclosure.
-   Add tests for calculations and missing factors.

### Phase E --- Map, plants, challenges and rewards

-   Implement environmental report/map.
-   Implement plant registry and follow-up monitoring.
-   Implement challenges and leaderboard privacy.
-   Implement rewards only where real partners/catalog exist.
-   Add admin configuration and aggregate analytics.

### Phase F --- AI enhancements and final hardening

-   Add AI only if provider is configured and approved.
-   Add anti-fraud improvements.
-   Run full regression/security checks.
-   Verify production build and deployment readiness.
-   Write deployment and rollback instructions.

**Important:** Complete and test Phase A--C as the first practical
deliverable. Do not spend the first work session building a decorative
map or AI showcase while submissions and points are not functional.

------------------------------------------------------------------------

## 15. REQUIRED DELIVERABLES

At the end, provide:

1.  `docs/ngopi-green-audit.md`
2.  Implemented source code integrated into the existing app.
3.  Database migrations and idempotent seed data.
4.  Bilingual translation files.
5.  Tests for core flows.
6.  `docs/ngopi-green-implementation.md` with actual files changed and
    what each does.
7.  `docs/ngopi-green-deployment.md` with environment variable
    **names**, migration steps, build/deploy steps, and rollback
    guidance.
8.  `docs/ngopi-green-carbon-methodology.md` listing every factor,
    source, version, region, formula, assumptions, limitations, and
    unsupported calculations.
9.  A final checklist identifying completed, partially completed, and
    blocked items.

Do not claim a feature is complete unless it has been implemented and
tested. Include actual test/build command outputs or concise results.
Clearly distinguish local implementation from production deployment.

------------------------------------------------------------------------

## 16. FINAL AGENT RESPONSE FORMAT

When finished, report:

-   What was inspected.
-   Actual stack and integration points discovered.
-   Files created/modified.
-   Database migrations created and whether they were applied.
-   How the Warkop menu opens NGOPI GREEN.
-   How ID/EN works.
-   How a user submits an activity.
-   How an admin verifies it.
-   Exactly how Ngopi Points are credited to the existing ledger.
-   What carbon metrics are calculated and which are not.
-   Tests/build results.
-   Any remaining blockers or required credentials.
-   Exact commands to run locally and deploy safely.

If the work cannot be completed in one session, leave the repository in
a coherent working state, summarize completed phases, and specify the
next exact task. Never conceal incomplete functionality behind a
polished static interface.

------------------------------------------------------------------------

## 17. PRODUCT PRINCIPLE

**NGOPI GREEN is not a points-farming game and not a fake carbon-offset
calculator.**

It is a practical environmental participation system:

-   Users perform real actions.
-   Evidence and data are collected responsibly.
-   Contributions are verified proportionally to risk.
-   Carbon and environmental impact are calculated transparently.
-   Ngopi Points are awarded through the existing trusted ledger.
-   Communities and institutions can use verified environmental
    information.
-   The system is honest about uncertainty, limitations, and what has
    not yet been measured.

**Every action matters. Every verified impact is accountable.**
