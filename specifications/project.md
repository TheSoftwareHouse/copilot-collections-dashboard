Dashboard for usage of github copilot in organisation.

Use Github API's to get list of the copilot seats - depending on configuration it should use organisation or enterprise endpoints for that. The seats should be checked daily and cannot be removed from application, however, unused one should be flagged with valid status.

Use Githubs API's (https://api.github.com/organizations/<organisation-name>>/settings/billing/premium_request/usage?user=<username>&day=<day>&month=<month>&year=<year>) to get per user usage. Should be checked on specific interval for earch user in the system that has an active seat. All data should be saved in database. In should be unique by user date month and year.

Example response for user:
{
	"timePeriod": {
		"year": 2026,
		"month": 2,
		"day": 1
	},
	"user": "wwojcik",
	"organization": "TheSoftwareHouse",
	"usageItems": [
		{
			"product": "Copilot",
			"sku": "Copilot Premium Request",
			"model": "Claude Haiku 4.5",
			"unitType": "requests",
			"pricePerUnit": 0.04,
			"grossQuantity": 2.97,
			"grossAmount": 0.1188,
			"discountQuantity": 2.97,
			"discountAmount": 0.1188,
			"netQuantity": 0.0,
			"netAmount": 0.0
		},
		{
			"product": "Copilot",
			"sku": "Copilot Premium Request",
			"model": "Claude Sonnet 4.5",
			"unitType": "requests",
			"pricePerUnit": 0.04,
			"grossQuantity": 53.0,
			"grossAmount": 2.12,
			"discountQuantity": 53.0,
			"discountAmount": 2.12,
			"netQuantity": 0.0,
			"netAmount": 0.0
		}
	]
}

The organisation / enterprise should be able to configure the app settings on first run, then it should be saved in database.

System should support logging by username and password and admin should be able to manage users.

User should be able to view list of seats with github username, status and editable firstname and lastname and department

On a dashboard a general usage metrics for specific month should be visible - number of seats, total usage per each model, most active users, least active users, current spending. The data should be filtarable by month.

In menu there should be usage with multiple tabs - Seat, Team, Department. The default active should be Seat. It should show a usage for specific month for each seat paginated.
When going to Team tab the same should be visible but for specific team and each member of it.
When going to Department the same metrics as Team should be visible but this time grouped by departments.

User should be able to define teams and members. Each team will have a name and consist of specific seats (github users). Based on a seats we want to ccalculate the current avg copilot premium requests usage of that team based on an indicidual team seats value. Each month the team composition might change and so we need to track it separately per month so we can see it over time.

User should be able to define departments. IT should be just name.

