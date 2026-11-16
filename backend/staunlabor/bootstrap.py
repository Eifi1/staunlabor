"""The first admin, made from the operator's terminal before the site opens (deploy/README.md §6).

The account layer makes the first account that registers the admin, if its address is on
``STAUNLABOR_REGISTRATION_ALLOWLIST``. Nothing proves that the address is the registrant's
(signing in needs no verified address), and the list is no secret (``cloudbuild.yaml``, the
imprint): between a deploy and the operator's own registration, a stranger who typed the
address first would hold the site. Made here, through the database's own credentials, the
account exists before the site does: the kit's first-admin path is closed for good (it opens
only while ``count_people()`` is 0), and everybody after comes by invitation.

    bash deploy/bootstrap-admin.sh     # migrates, then asks for the address, the name, the password

It asks in the terminal and never prints the password; it changes nothing once any account
exists. The address is left unconfirmed: the account confirms it the usual way, by the mail
the settings send, which is also the first proof that mail reaches the operator.
"""

from __future__ import annotations

import asyncio
import getpass
import sys
from collections.abc import Callable

from eifi1_server_kit.auth.bcrypt_hasher import BcryptHasher
from eifi1_server_kit.auth.ports import NewAccount
from eifi1_server_kit.auth.schemas import DEFAULT_LOCALE, Email, LocaleTag, NewPassword, PersonName
from eifi1_server_kit.auth.sql import SqlUserStore
from pydantic import BaseModel, ValidationError

from staunlabor.database import Database
from staunlabor.models import Role, User
from staunlabor.settings import Settings, get_settings

#: The operator's zone, for the account's notices until a browser sets its own.
ZONE = "Europe/Zurich"


class FirstAdmin(BaseModel):
    """What the registration form would take, by the kit's own rules: the address
    normalised, the password at least the kit's minimum and within bcrypt's limit."""

    email: Email
    password: NewPassword
    first_name: PersonName
    last_name: PersonName
    locale: LocaleTag = DEFAULT_LOCALE


async def make_first_admin(database: Database, settings: Settings, admin: FirstAdmin) -> bool:
    """The admin's account, if the database has none yet; ``False`` and nothing written
    otherwise."""
    async with database.sessions() as session:
        users = SqlUserStore(session, User)
        if await users.count_people() > 0:
            return False
        await users.add(
            NewAccount(
                email=admin.email,
                password_hash=BcryptHasher(settings.bcrypt_rounds).hash(admin.password),
                first_name=admin.first_name,
                last_name=admin.last_name,
                locale=admin.locale,
                role=Role.ADMIN,
                device_timezone=ZONE,
            )
        )
        await session.commit()
    return True


def ask(read: Callable[[str], str] = input, secret: Callable[[str], str] = getpass.getpass) -> FirstAdmin | None:
    """The admin's details from the terminal, the password twice and never echoed; ``None``
    and the reason said when they would not make an account."""
    email = read("Address: ").strip()
    first_name = read("First name: ")
    last_name = read("Last name: ")
    password = secret("Password: ")
    if secret("Password again: ") != password:
        print("The two passwords differ: nothing done.")
        return None
    try:
        return FirstAdmin(email=email, password=password, first_name=first_name, last_name=last_name)
    except ValidationError as exc:
        # The fields by name and the rule they broke; never the input, which may be the password.
        fields = ", ".join(f"{'.'.join(map(str, e['loc']))}: {e['msg']}" for e in exc.errors(include_input=False))
        print(f"Not an account the site would take ({fields}): nothing done.")
        return None


async def _run(settings: Settings, admin: FirstAdmin) -> bool:
    database = Database(settings)
    try:
        return await make_first_admin(database, settings, admin)
    finally:
        await database.dispose()


def main() -> int:
    admin = ask()
    if admin is None:
        return 1
    if not asyncio.run(_run(get_settings(), admin)):
        print("The database has accounts already: nothing done. Invite from the admin page instead.")
        return 1
    print(f"Done: {admin.email} is the admin. Sign in at the site once it is deployed.")
    return 0


if __name__ == "__main__":  # pragma: no cover - the module's command line
    sys.exit(main())
