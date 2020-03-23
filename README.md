# puppeteer-confluence-setup

⚠️ This is not mean to be used for production instances.

A [puppeteer](https://github.com/puppeteer/puppeteer) based script and Docker image to automate the initial setup of Confluence for testing purposes.

After many years spinning up standalone instances of Confluence for testing purposes as part of my work at [Comalatech](https://comalatech.com), I created the project [docker-confluence-for-testing](https://github.com/aruizca/docker-confluence-for-testing) to do that automagically inside a Docker container with the chance to run any Confluence version, on different external DB engines *not H2) and optionally using an external LDAP. The problem is that each time you spin up a new instance you have to manually go through the initial setup as Atlassian is yet to provide an unsupervised mechanism to perform that setup 🤦🏻‍♂️

I don't know how many times I have repeated the same process manually, **but those days are over thanks to this script** 😊

## How does it work?

This script uses puppeteer in order to automate the following setup steps:

- Installation type selection
- License set up
- Configuring Database
- User Configuration setup
- Disable Confluence Onboarding module
- Setting Confluence base url to use localhost as hostname

There are two ways this script can be used:

### As a script inside a Docker image

...along with the [docker-confluence-for-testing](https://github.com/aruizca/docker-confluence-for-testing) script. It should be used from there. But if you want, you can get the Docker image from [Docker Hub](https://hub.docker.com/repository/docker/aruizca/puppeteer-confluence-setup).

### As a node.js script for any Confluence image

Just clone this repo, install the dependencies and run it providing environment variables if you want/need:

```javascript
npm i
[ENV1=VALUE1 ENV2=VALUE2] npm start
```

## Environment variables available

VAR NAME | DEFAULT VALUE
-------- | -------------
PPTR_CONFLUENCE_BASE_URL | http://localhost:8090/confluence
PPTR_CONFLUENCE_LICENSE | [A 3 hours timebob license](https://developer.atlassian.com/platform/marketplace/timebomb-licenses-for-testing-server-apps/)
PPTR_DB_USER | postgres
PPTR_DB_PASSWORD | postgres
PPTR_JDBC_URL | jdbc:postgresql://postgres:5432/confluence
PPTR_HEADLESS | false

## Versions supported

For now the script supports any version from 6.0.x to 7.x.

### How long does it take?

These are the benchmarks to complete the setup in different Confluence version:

| Confluence Version | Time taken to complete setup |
| :----------------: | ---------------------------: |
| 6.0.7  | 157.856 s |
| 6.6.17 | 174.286 s |
| 7.3.3  | 204.567 s |

⚠️ Note how each newer version steadily requires more time to complete the same process.