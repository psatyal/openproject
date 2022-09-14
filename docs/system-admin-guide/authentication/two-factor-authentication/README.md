---
sidebar_navigation:
  title: Two-factor authentication
  priority: 700
description: configure two-factor authentication for OpenProject.
keywords: two-factor authentication
---
# Two-factor authentication (2FA)

Note: This feature is available for the Enterprise on-premises only. For more information and differences to Community Edition, [see this page](https://www.openproject.org/pricing/).

## Basic 2FA using TOTP

To activate and **configure two-factor authentication** for OpenProject, navigate to -> *Administration* -> *Authentication* and choose -> *two-factor authentication*.

From the GUI you are able to configure the following options:

1. **Enforce 2FA** (two-factor authentication) for every user. All users will be forced to [register a 2FA device](../../../getting-started/my-account/#two-factor-authentication-premium-feature) on their next login.
2. **Remember 2FA login** for a given number of days, e.g. 30 days.
3. Press the blue **Apply** button to save your changes.

![Sys-admin-authentication-two-factor-authentication](Sys-admin-authentication-two-factor-authentication.png)

Usually with another device device like a mobile phone or a tablet, you are able to use a TOTP Application in order to generate the token that is needed as an extra layer of security on top of your password. Here are some applications that work for OpenProject 2FA.

- Open Source andOTP (Android Device) in the [Play Store](https://play.google.com/store/apps/details?id=org.shadowice.flocke.andotp&gl=US)

- Open Source OTP Auth (Apple Devices) in the [Apple Store](https://apps.apple.com/us/app/otp-auth/id659877384)

- Google Authenticator
- Microsoft Authenticator

## Advanced 2FA using MessageBird, Amazon SNS

At the moment the advanced settings for improved security are only reachable on the by defining [configuration variables](https://www.openproject.org/docs/installation-and-operations/configuration/).

The how to is explained in the  configuration is explained in the [Two-factor authentication](https://www.openproject.org/docs/installation-and-operations/configuration/#two-factor-authentication) paragraph.
