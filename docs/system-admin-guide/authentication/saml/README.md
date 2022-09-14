---
sidebar_navigation:
  title: SAML single sign-on
  priority: 800
description: How to set up SAML integration for SSO with OpenProject.
keywords: SAML, SSO, single sign-on, authentication
---
# SAML

> **Note**: This documentation is valid for the OpenProject Enterprise Edition only.

You can integrate your active directory or other SAML compliant identity provider in your OpenProject Enterprise Edition.

## Enterprise Cloud

For the moment in the Enterprise cloud OpenProject DevOps team has to apply the configuration for you. The configuration has to be provided in a support ticket, for instance as a YAML file as described in the docs.
Experience shows that configuring this can be tricky, though. So it may take a bit until the correct configuration is finished with your SAML provider.
If you have the chance to test the SAML configuration on an Enterprise on-premises installation this might speed things up. But we can make it work either way.

## Enterprise on-premises

### Prerequisites

In order to use integrate OpenProject as a service provider (SP) using SAML, your identity providers (idP):

- needs to be able to handle SAML 2.0 redirect Single-Sign On (SSO) flows, in some implementations also referred to as WebSSO
- has a known or configurable set of attributes that map to the following required OpenProject attributes. The way these attribute mappings will be defined is described later in this document.
  - **login**: A stable attribute used to uniquely identify the user. This will most commonly map to an account ID, samAccountName or email (but please note that emails are often interchangeable, and this might result in logins changing in OpenProject).
  - **email**: The email attribute of the user being authenticated
  - **first name** and **last name** of the user.
- provides the public certificate or certificate fingerprint (SHA1) in use for communicating with the idP.

### 1: Configuring the SAML integration

The configuration can be provided in one of two ways:

* `config/configuration.yml` file (1.1)

* Environment variables (1.2)

* Settings in the database (1.3)

  

Whatever means are chosen, the plugin simply passes all options to omniauth-saml. See [their configuration
documentation](https://github.com/omniauth/omniauth-saml#usage) for further details.

The options are mutually exclusive. I.e. if settings are already provided via ENV variables, they will overwrite settings in a `configuration.yml` file.
If you decide to save settings in the database, they will override any ENV variables you might have set.

#### 1.1 config/configuration.yml file

In your OpenProject packaged installation, you can modify the `/opt/openproject/config/configuration.yml` file. 
Edit the file in your favorite editor

```
vim /opt/openproject/config/configuration.yml
```

This will contains the complete OpenProject configuration and can be extended to also contain metadata settings and connection details for your SSO identity provider.

The following is an exemplary file with a set of common settings:

```yaml
saml:
  # Name of the provider, leave this at saml unless you use multiple providers
  name: "saml"
  # The name that will be display in the login button
  display_name: "My SSO"
  # Use the default SAML icon
  icon: "auth_provider-saml.png"

  # The callback within OpenProject that your idP should redirect to
  assertion_consumer_service_url: "https://<YOUR OPENPROJECT HOSTNAME>/auth/saml/callback"
  # The SAML issuer string that OpenProject will call your idP with
  issuer: "https://<YOUR OPENPROJECT HOSTNAME>"

  # IF your SSL certificate on your SSO is not trusted on this machine, you need to add it here in ONE line
  ### one liner to generate certificate in ONE line
  ### awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' <yourcert.pem>
  #idp_cert: "-----BEGIN CERTIFICATE-----\n ..... SSL CERTIFICATE HERE ...-----END CERTIFICATE-----\n"
  # Otherwise, the certificate fingerprint must be added
  # Either `idp_cert` or `idp_cert_fingerprint` must be present!
  idp_cert_fingerprint: "E7:91:B2:E1:..."

  # Replace with your SAML 2.0 redirect flow single sign on URL
  # For example: "https://sso.example.com/saml/singleSignOn"
  idp_sso_target_url: "<YOUR SSO URL>"
  # Replace with your redirect flow single sign out URL
  # or comment out
  # For example: "https://sso.example.com/saml/proxySingleLogout"
  idp_slo_target_url: "<YOUR SSO logout URL>"

  # Attribute map in SAML
  attribute_statements:
    # What attribute in SAML maps to email (default: mail)
    email: ['mail']
    # What attribute in SAML maps to the user login (default: uid)
    login: ['uid']
    # What attribute in SAML maps to the first name (default: givenName)
    first_name: ['givenName']
    # What attribute in SAML maps to the last name (default: sn)
    last_name: ['sn']
```

Be sure to choose the correct indentation and base key. The items below the `saml` key should be indented two spaces more than `saml` already is. And `saml` can will need to be placed in the `default` or `production` group so it will already be indented. You will get an YAML parsing error otherwise when trying to start OpenProject.

#### 1.2 Environment variables

As with [all the rest of the OpenProject configuration settings](../../../installation-and-operations/configuration/environment/), the SAML configuration can be provided via environment variables.

E.g.

```bash
# Name of the provider, leave this at saml unless you use multiple providers
OPENPROJECT_SAML_SAML_NAME="saml"

# The name that will be display in the login button
OPENPROJECT_SAML_SAML_DISPLAY__NAME="<Name of the login button>"

# The callback within OpenProject that your idP should redirect to
OPENPROJECT_SAML_SAML_ASSERTION__CONSUMER__SERVICE__URL="https://<openproject.host>/auth/saml/callback"

# The SAML issuer string that OpenProject will call your idP with
OPENPROJECT_SAML_SAML_ISSUER="https://<openproject.host>"

# IF your SSL certificate on your SSO is not trusted on this machine, you need to add it here in ONE line
### one liner to generate certificate in ONE line
### awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' <yourcert.pem>
#idp_cert: "-----BEGIN CERTIFICATE-----\n ..... SSL CERTIFICATE HERE ...-----END CERTIFICATE-----\n"
# Otherwise, the certificate fingerprint must be added
# Either `OPENPROJECT_SAML_SAML_IDP__CERT` or `OPENPROJECT_SAML_SAML_IDP__CERT__FINGERPRINT` must be present!
OPENPROJECT_SAML_SAML_IDP__CERT="-----BEGIN CERTIFICATE-----<cert one liner>-----END CERTIFICATE-----"
OPENPROJECT_SAML_SAML_IDP__CERT__FINGERPRINT="da:39:a3:ee:5e:6b:4b:0d:32:55:bf:ef:95:60:18:90:af:d8:07:09"
# Replace with your single sign on URL, the exact value depends on your idP implementation
OPENPROJECT_SAML_SAML_IDP__SSO__TARGET__URL="https://<hostname of your idp>/application/saml/<slug>/sso/binding/post/"

# (Optional) Replace with your redirect flow single sign out URL that we should redirect to
OPENPROJECT_SAML_SAML_IDP__SLO__TARGET__URL=""

# 
# Which SAMLAttribute we should look for for the corresponding attributes of OpenProject
# can be a string or URI/URN depending on our idP format
OPENPROJECT_SAML_SAML_ATTRIBUTE__STATEMENTS_EMAIL="mail"
OPENPROJECT_SAML_SAML_ATTRIBUTE__STATEMENTS_LOGIN="mail"
OPENPROJECT_SAML_SAML_ATTRIBUTE__STATEMENTS_FIRST__NAME="givenName"
OPENPROJECT_SAML_SAML_ATTRIBUTE__STATEMENTS_LAST__NAME="sn"
# You can also specify an array of attributes, the first found value will be used. Example:
# OPENPROJECT_SAML_SAML_ATTRIBUTE__STATEMENTS_LOGIN="['mail', 'samAccountName', 'uid']"
```

Please note that every underscore (`_`) in the original configuration key has to be replaced by a duplicate underscore
(`__`) in the environment variable as the single underscore denotes namespaces. For more information, follow our [guide on environment variables](../../../installation-and-operations/configuration/environment/).

#### 1.3 Settings in database

The SAML settings can also be changed at runtime in the database through the OpenProject settings.
As opposed to other settings there is no user interface for this.
That means it's best to set them using the console.

```
# package based installation:
> sudo openproject run console

# docker-based installation:
> docker exec -it openproject bundle exec rails console

# docker-compose-based installation:
> docker-compose run --rm web bundle exec rails console
```

Once on the console you can set the same values as named in the `configuration.yml` file, however they need to be nested within a 'providers' key as follows.
For example:

```ruby
Setting.plugin_openproject_auth_saml = Hash(Setting.plugin_openproject_auth_saml).deep_merge({
  "providers" => {
    "saml" => {
      "name" => "saml",
      "display_name" => "My SSO",
      "assertion_consumer_service_url" => "https://<YOUR OPENPROJECT HOSTNAME>/auth/saml/callback",
      # The SAML issuer string that OpenProject will call your idP with
      "issuer" => "https://<YOUR OPENPROJECT HOSTNAME>",
      ### one liner to generate certificate in ONE line
      ### awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' <yourcert.pem>
      "idp_cert" => "-----BEGIN CERTIFICATE-----\nMI................IEr\n-----END CERTIFICATE-----\n",
      # Otherwise, the certificate fingerprint must be added
 	  # Either `idp_cert` or `idp_cert_fingerprint` must be present!
	  "idp_cert_fingerprint" => "E7:91:B2:E1:...",

      # Replace with your SAML 2.0 redirect flow single sign on URL
      # For example: "https://sso.example.com/saml/singleSignOn"
      "idp_sso_target_url" => "<YOUR SSO URL>",
      # Replace with your redirect flow single sign out URL
      # or comment out
      # For example: "https://sso.example.com/saml/proxySingleLogout"
      "idp_slo_target_url" => "<YOUR SSO logout URL>",

      # Attribute map in SAML
      "attribute_statements" => {
        # What attribute in SAML maps to email (default: mail)
        "email" => ['mail'],
        # What attribute in SAML maps to the user login (default: uid)
        "login" => ['uid'],
        # What attribute in SAML maps to the first name (default: givenName)
        "first_name" => ['givenName'],
        # What attribute in SAML maps to the last name (default: sn)
        "last_name" => ['sn']
      }
    }
  }
})
```

### 2. Configuration details

In this section, we detail some of the required and optional configuration options for SAML.


**Mandatory: Response signature verification**

SAML responses by identity providers are required to be signed. You can configure this by either specifying the response's certificate fingerprint in `idp_cert_fingerprint` , or by passing the entire PEM-encoded certificate string in `idp_cert` (beware of newlines and formatting the cert, [c.f. the idP certificate options in omniauth-saml](https://github.com/omniauth/omniauth-saml#options))



**Mandatory: Attribute mapping**

Use the key `attribute_statements` to provide mappings for attributes returned by the SAML identity provider's response to OpenProject internal attributes. 

**a) Attribute mapping example for settings.yml**

```yaml
# <-- other configuration -->
# Attribute map in SAML
attribute_statements:
  # Use the `mail` attribute for 
  email: ['mail']
  # Use the mail address as login
  login: ['mail']
  # What attribute in SAML maps to the first name (default: givenName)
  first_name: ['givenName']
  # What attribute in SAML maps to the last name (default: sn)
  last_name: ['sn']
```

You may provide attribute names or namespace URIs as follows: `email: ['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress']`. 

The OpenProject username is taken by default from the `email` attribute if no explicit login attribute is present.

**b) Attribute mapping example for database**

```ruby
Setting.plugin_openproject_auth_saml = Hash(Setting.plugin_openproject_auth_saml).deep_merge({
  "providers" => {
    "saml" => {
       # ... other attributes, see above.
       # Attribute map in SAML
      "attribute_statements" => {
        # What attribute in SAML maps to email (default: mail)
        "email" => ['mail'],
        # another example for combined attributes in an array:
        "login" => ['username', 'samAccountName', 'uid'],
        # What attribute in SAML maps to the first name (default: givenName)
        "first_name" => ['givenName'],
        # What attribute in SAML maps to the last name (default: sn)
        "last_name" => ['sn']
      }
    }
  }
})
```



**Optional: Setting the attribute format**

By default, the attributes above will be requested with the format `urn:oasis:names:tc:SAML:2.0:attrname-format:basic`.
That means the response should contain attribute names 'mail', etc. as configured above.

If you have URN or OID attribute identifiers, you can modify the request as follows:

```yaml
# <-- other configuration -->
# Modify the request attribute sent in the request
# These oids are exemplary, but will often be identical,
# please check with your identity provider for the correct oids
request_attributes:
  - name: 'urn:oid:0.9.2342.19200300.100.1.3'
    friendly_name: 'Mail address'
    name_format: urn:oasis:names:tc:SAML:2.0:attrname-format:uri
  - name: 'urn:oid:2.5.4.42'
    friendly_name: 'First name'
    name_format: urn:oasis:names:tc:SAML:2.0:attrname-format:uri
  - name: 'urn:oid:2.5.4.4'
    friendly_name: 'Last name'
    name_format: urn:oasis:names:tc:SAML:2.0:attrname-format:uri

# Attribute map in SAML
attribute_statements:
  email: ['urn:oid:0.9.2342.19200300.100.1.3']
  login: ['urn:oid:0.9.2342.19200300.100.1.3']
  first_name: ['urn:oid:2.5.4.42']
  last_name: ['urn:oid:2.5.4.4']
```

**Optional: Request signature and Assertion Encryption**

Your identity provider may optionally encrypt the assertion response, however note that with the required use of TLS transport security, in many cases this is not necessary. You may wish to use Assertion Encryption if TLS is terminated before the OpenProject application server (e.g., on the load balancer level).

To configure assertion encryption, you need to provide the certificate to send in the request and private key to decrypt the response:

```yaml
  certificate: "-----BEGIN CERTIFICATE-----\n .... certificate contents ....\n-----END CERTIFICATE-----",
  private_key: "-----BEGIN PRIVATE KEY-----\n .... private key contents ....\n-----END PRIVATE KEY-----"
```

Request signing means that the service provider (OpenProject in this case) uses the certificate specified to sign the request to the identity provider. They reuse the same `certificate` and `private_key` settings as for assertion encryption. It is recommended to use an RSA key pair, the key must be provided without password.

To enable request signing, enable the following flag:

```yaml
  certificate: "-----BEGIN CERTIFICATE-----\n .... certificate contents ....\n-----END CERTIFICATE-----",
  private_key: "-----BEGIN PRIVATE KEY-----\n .... private key contents ....\n-----END PRIVATE KEY-----",
  security: {
    # Whether SP and idP should sign requests and assertions
    authn_requests_signed: true,
    want_assertions_signed: true,
    # Whether the idP should encrypt assertions
    want_assertions_signed: false,
    embed_sign: true,
    signature_method: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
    digest_method: 'http://www.w3.org/2001/04/xmlenc#sha256',
  }
```


With request signing enabled, the certificate will be added to the identity provider to validate the signature of the service provider's request.


### 3: Restarting the server

Once the configuration is completed, restart your OpenProject server with `service openproject restart`.  If you configured SAML through settings, this step can be ignored.

#### XML Metadata exchange

The configuration will enable the SAML XML metadata endpoint at `https://<your openproject host>/auth/saml/metadata`
for service discovery use with your identity provider.

### 4: Logging in

From there on, you will see a button dedicated to logging in via SAML, e.g named "My SSO" (depending on the name you chose in the configuration), when logging in. Clicking it will redirect to your SSO provider and return with your attribute data to set up the account, or to log in.

![my-sso](my-sso.png)



## Troubleshooting

Q: After clicking on a provider badge, I am redirected to a signup form that says a user already exists with that login.

A: This can happen if you previously created user accounts in OpenProject with the same email than what is stored in the identity provider. In this case, if you want to allow existing users to be automatically remapped to the SAML identity provider, you should do the following:

Spawn an interactive console in OpenProject. The following example shows the command for the packaged installation.
See [our process control guide](../../../installation-and-operations/operation/control/) for information on other installation types.

```
sudo openproject run console
> Setting.oauth_allow_remapping_of_existing_users = true
> exit
```

Then, existing users should be able to log in using their SAML identity. Note that this works only if the user is using password-based authentication, and is not linked to any other authentication source (e.g. LDAP) or OpenID provider.



Q: Could the users be automatically logged in to OpenProject if they are already authenticated at the SAML Identity Provider?

A: You are able to chose a default direct-login-provider in the `/opt/openproject/config/configuration.yml` or by using environment variables

```
omniauth_direct_login_provider: saml
```

[Read more](../../../installation-and-operations/configuration/#omniauth-direct-login-provider)



Q: `"certificate"` and `"private key"` are used in the SAML configuration and openproject logs show a FATAL error after GET "/auth/saml"  `**FATAL** -- :  OpenSSL::PKey::RSAError (Neither PUB key nor PRIV key: nested asn1 error):`

A1: The given private_key is encrypted. The key is needed without the password (cf., https://github.com/onelogin/ruby-saml/issues/473)

A2: The provided key pair is not an RSA key. ruby-saml might expect an RSA key.
