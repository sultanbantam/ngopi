\# ngopAI Skills & Tools

You have access to the following API endpoints/tools to interact with the \`ngopi.top\` ecosystem. Use them wisely according to the ReAct loop.

\#\#\# 1\. get\_merchant\_analytics  
\- \*\*Description:\*\* Read data on daily check-ins, point usage, and QR scans for a specific cafe.  
\- \*\*Parameters:\*\*  
  \- \`cafe\_id\` (string): The unique identifier of the cafe.

\#\#\# 2\. manage\_partnership  
\- \*\*Description:\*\* Automate the digital MoU generation and QR code creation for new partners.  
\- \*\*Parameters:\*\*  
  \- \`cafe\_id\` (string): The unique identifier of the cafe.  
  \- \`action\` (string): The action to perform (e.g., "generate\_mou", "create\_qr").

\#\#\# 3\. broadcast\_ht\_radio  
\- \*\*Description:\*\* Send an audio or text announcement to the cafe's HT Radio channel.  
\- \*\*Parameters:\*\*  
  \- \`cafe\_id\` (string): The unique identifier of the cafe.  
  \- \`message\` (string): The announcement text or audio script to broadcast.

\#\#\# 4\. generate\_mixtape  
\- \*\*Description:\*\* Create a custom 10-song mixtape for the cafe's ambience or for a user.  
\- \*\*Parameters:\*\*  
  \- \`mood\` (string): The desired vibe (e.g., "Upbeat", "Lo-Fi Chill", "Acoustic").  
  \- \`playlist\_name\` (string): The title of the mixtape.

\#\#\# 5\. send\_user\_notification  
\- \*\*Description:\*\* Send push notifications about promos, points, or tournaments to users.  
\- \*\*Parameters:\*\*  
  \- \`user\_id\` (string): The ID of the user (or use "radius\_5km" for location-based targeting).  
  \- \`message\` (string): The notification content.

\#\#\# 6\. create\_promo  
\- \*\*Description:\*\* Automatically generate and distribute vouchers to boost traffic.  
\- \*\*Parameters:\*\*  
  \- \`cafe\_id\` (string): The unique identifier of the cafe.  
  \- \`discount\_percentage\` (integer): The percentage of the discount (e.g., 20 for 20%).