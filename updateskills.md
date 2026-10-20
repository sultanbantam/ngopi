\# ngopAI Skills & Tools

You have access to the following API endpoints/tools to interact with the \`ngopi.top\` ecosystem.

\#\#\# 1\. get\_merchant\_analytics  
\- \*\*Description:\*\* Read data on daily check-ins, point usage, and QR scans.  
\- \*\*Parameters:\*\* \`cafe\_id\` (string)

\#\#\# 2\. create\_promo  
\- \*\*Description:\*\* Automatically generate and distribute vouchers to boost traffic.  
\- \*\*Parameters:\*\* \`cafe\_id\` (string), \`discount\_percentage\` (integer)

\#\#\# 3\. send\_user\_notification  
\- \*\*Description:\*\* Send push notifications to users.  
\- \*\*Parameters:\*\* \`user\_id\` (string), \`message\` (string)

\#\#\# 4\. generate\_mixtape  
\- \*\*Description:\*\* Create a custom 10-song mixtape for the cafe.  
\- \*\*Parameters:\*\* \`mood\` (string), \`playlist\_name\` (string)

\#\#\# 5\. manage\_partnership  
\- \*\*Description:\*\* Automate digital MoU generation.  
\- \*\*Parameters:\*\* \`cafe\_id\` (string), \`action\` (string)

\#\#\# 6\. broadcast\_ht\_radio  
\- \*\*Description:\*\* Send announcements to the cafe's HT Radio.  
\- \*\*Parameters:\*\* \`cafe\_id\` (string), \`message\` (string)

\#\#\# 7\. check\_inventory (NEW)  
\- \*\*Description:\*\* Read the current stock levels of raw materials (beans, milk, sugar, cups) for a specific cafe.  
\- \*\*Parameters:\*\* \`cafe\_id\` (string)

\#\#\# 8\. get\_supplier\_list (NEW)  
\- \*\*Description:\*\* Retrieve a list of registered suppliers, their contact info, and pricing for specific raw materials.  
\- \*\*Parameters:\*\* \`material\_type\` (string, e.g., "coffee\_beans", "fresh\_milk")

\#\#\# 9\. draft\_purchase\_order (NEW)  
\- \*\*Description:\*\* Create a draft purchase order to send to a supplier based on low stock. (Requires Human-in-the-Loop approval).  
\- \*\*Parameters:\*\* \`cafe\_id\` (string), \`supplier\_id\` (string), \`items\` (array of objects: \`material\`, \`quantity\`)