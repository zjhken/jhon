# Publishing to Maven Central

The `release` Maven profile in `pom.xml` already wires up javadoc/sources generation,
GPG signing, and upload to the Sonatype Central Portal. This guide covers the
environment and account setup that lives **outside** the repo — the one-time
preparation and the per-machine credentials you need before `mvn clean deploy -P release`
can run.

## Prerequisites

Verify each tool is installed:

- **JDK 21+** — `java --version` (matches `<source>21</source>` in `pom.xml`).
- **Maven** — `mvn --version`.
- **Git** — `git --version`.
- **GPG / GnuPG** — `gpg --version` (download from https://gnupg.org/download).

## One-time setup

These steps are done once per publisher account. They do not touch the repository.

### 1. Sonatype Central Portal account

Sign up at https://central.sonatype.com.

### 2. Namespace registration and verification

Register the namespace `io.github.zjhken` under *Publishing → View Namespaces → Add Namespace*.
This is a GitHub-backed namespace, so verification is done by creating a GitHub repository
with the exact name Sonatype provides (not a DNS `TXT` record — that path applies only to
custom-domain namespaces). See https://central.sonatype.org/register/namespace/.

### 3. Sonatype user token

Generate a user token at https://central.sonatype.com/account (*Generate User Token*).
Copy both the **username** and **password** — the token is shown once and cannot be
retrieved later. These go into `~/.m2/settings.xml` below.

### 4. GPG key

Generate a signing key (RSA 4096 recommended):

```shell
gpg --gen-key
gpg --list-keys --keyid-format 0xshort
```

Distribute the public key so Maven Central can verify signatures — upload to multiple
keyservers for redundancy:

```shell
gpg --keyserver keyserver.ubuntu.com --send-keys <KEY_ID>
gpg --keyserver keys.openpgp.org     --send-keys <KEY_ID>
gpg --keyserver pgp.mit.edu          --send-keys <KEY_ID>
```

Back up the private key somewhere safe: `gpg --export-secret-keys --armor <KEY_ID> > private.key`.

## Local Maven configuration

Add the Sonatype token to `~/.m2/settings.xml`. The `<server>` id **must** be `central`
to match `publishingServerId` in `pom.xml`:

```xml
<settings xmlns="http://maven.apache.org/SETTINGS/1.0.0"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:schemaLocation="http://maven.apache.org/SETTINGS/1.0.0 https://maven.apache.org/xsd/settings-1.0.0.xsd">
  <servers>
    <server>
      <id>central</id>
      <username>YOUR_SONATYPE_TOKEN_USERNAME</username>
      <password>YOUR_SONATYPE_TOKEN_PASSWORD</password>
    </server>
  </servers>

  <profiles>
    <profile>
      <id>gpg</id>
      <activation>
        <activeByDefault>true</activeByDefault>
      </activation>
      <properties>
        <gpg.keyname>0xABCD1234</gpg.keyname>   <!-- your key id from gpg --list-keys -->
      </properties>
    </profile>
  </profiles>
</settings>
```

The `gpg.keyname` property is read by the GPG plugin configured in `pom.xml`. Putting it
in a default-active profile avoids passing `-Dgpg.keyname=...` on every release. The
passphrase is prompted interactively at deploy time (the plugin already sets
`--pinentry-mode loopback`); for non-interactive runs add `-Dgpg.passphrase=...`.

## Publishing

```shell
mvn clean deploy -P release
```

The `release` profile builds the main JAR, attaches `-sources` and `-javadoc` JARs,
GPG-signs every artifact, uploads them to the Central Portal, and auto-publishes
(`autoPublish=true`, `waitUntil=uploaded`). Track status at
https://central.sonatype.com/publishing — it moves `uploaded → publishing → published`.

## Verifying the release

After a few minutes (sync can take a bit), confirm the artifact is reachable:

```shell
mvn dependency:get -Dartifact=io.github.zjhken:jhon:<version>
```

`BUILD SUCCESS` means it is on Central. You can also browse:

- https://central.sonatype.com/
- https://search.maven.org/

Consumers can then depend on it:

```xml
<dependency>
  <groupId>io.github.zjhken</groupId>
  <artifactId>jhon</artifactId>
  <version><version></version>
</dependency>
```

## Troubleshooting

- **Signature validation failed** — public key not propagated to keyservers, or
  `gpg.keyname` does not match the signing key. Re-upload and confirm with
  `gpg --keyserver keyserver.ubuntu.com --recv-keys <KEY_ID>`.
- **Metadata / coordinate checks failed** — see
  https://central.sonatype.org/publish/requirements/ for the versioning and naming rules.
- **401 Unauthorized on upload** — the `<server>` id is not `central`, or the Sonatype
  token is stale. Regenerate the token and update `settings.xml`.
