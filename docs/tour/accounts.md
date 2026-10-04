# Accounts and library

How do I keep my dashboards on every device, go Pro, and publish one for other fans?

![The sign-in dialog.](accounts/sign-in-dialog.png)

_One email, no password._

![Check your inbox.](accounts/sign-in-sent.png)

_A sign-in link arrives by email; opening it signs you in._

![The account page on the Free plan.](accounts/account-free.png)

_Plan, Go Pro, and Your data: export or delete everything._

![The account page in the light theme.](accounts/account-free-light.png)

_The light theme._

![The account page on a phone.](accounts/account-free-phone.png)

_The account page on a phone._

![Delete your account.](accounts/account-delete.png)

_Deleting asks you to type your email first._

![The Free limit toast.](accounts/free-limit.png)

_Free keeps three dashboards of your own; the fourth offers Go Pro._

![The bar menu with Preview Pro.](accounts/menu-preview-pro.png)

_Preview Pro tries the Pro tiles without paying._

![The checkout page.](accounts/checkout.png)

_In development, checkout uses a fake payment provider. In production it is Stripe._

![The account page on Pro.](accounts/account-pro.png)

_After paying: Pro, with its renewal date._

![Choosing a handle to publish under.](accounts/publish-handle.png)

_Pro publishes under a handle chosen once; reserved names and profanity are refused._

![The publish dialog.](accounts/publish-dialog.png)

_A description and tags, then Publish._

![The published dashboard in the library.](accounts/library-published.png)

_It appears in From fans with your handle._

![Alerts settings.](accounts/alerts.png)

_Alerts: what to be told, quiet hours, and how long to wait before a push._

## How to get there

- The `...` menu in the bar has Sign in (or Account), Library, Alerts and Preview Pro.
- `/account` holds the plan and your data, `/alerts` the alert settings, `/library` the library.
- Accounts in these pictures are throwaway `@example.test` addresses on an in-memory server, deleted after each shot.

Product docs: [Free and Pro](../product/dashboards.md#free-and-pro) and [How people move through the app](../product/flows.md). Hosting, Stripe and email for real: [deploy](../deploy.md).

[Back to the tour](README.md)
