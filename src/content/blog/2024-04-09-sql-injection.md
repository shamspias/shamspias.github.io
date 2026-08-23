---
title: "SQL Injection: When Your Query Is Written by the Attacker"
description: "The clearest case of data becoming code. How a login form ends up running the attacker's SQL, why escaping is the wrong fix, and the one that actually ends it."
date: 2024-04-09
permalink: "/posts/2024/04/sql-injection/"
lang: en
tags:
  - "security"
  - "web security"
  - "sql injection"
  - "databases"
series: "Security From the Ground Up"
seriesOrder: 2
math: false
---

*SQL injection is the textbook example of the first master bug from [part 1](/posts/2024/03/what-security-actually-is/): data mistaken for code. It has been in the top handful of web vulnerabilities for over two decades, not because it is hard to fix, but because the wrong way to build a query is also the most natural way. This post is how it works, the fixes that do not work, and the one that does, permanently.*

## 1. How a query gets hijacked

A database query is a program written in SQL. When you build that program by pasting user input into a string, the user can write part of the program. That is the entire bug.

Here is a login check, written the way it looks obvious to write:

```sql no-compile
-- the template the developer wrote, with <user> and <pass> filled in
SELECT * FROM users
WHERE username = '<user>' AND password = '<pass>';
```

The application builds it by concatenation:

```pseudo
  query = "SELECT * FROM users WHERE username = '"
        + username
        + "' AND password = '" + password + "'";
```

Now the attacker types, as the username, this:

```
  admin'  --
```

The `'` closes the username string early, and `--` starts a SQL comment, which throws away the rest of the line. The query the database actually runs becomes:

```sql no-compile
SELECT * FROM users
WHERE username = 'admin'  --' AND password = '...';
```

Everything after `--` is a comment. The password check is gone. The attacker is logged in as `admin` without knowing the password. They did not break the database; they wrote a different query, using the one input slot you gave them, because that slot was never really "data" to the database. It was raw SQL.

```
  you thought the input went here:      username = [   data   ]
  but the database saw:                 username = 'admin' -- [ code ]
                                                          ^^
                                            data broke out into code
```

## 2. What it lets an attacker do

Bypassing a login is the friendly demonstration. The same mechanism, on a query that returns data, reads data. The classic condition an attacker appends is one that is always true:

```
  ' OR '1'='1
```

which turns `WHERE username = ''` into `WHERE username = '' OR '1'='1'`, and `'1'='1'` is true for every row, so the query returns the whole table.

From there the escalation is well understood and worth knowing so you grasp the stakes:

- **Reading other tables.** A `UNION SELECT` can graft the result of a second query, over a different table, onto the first. If the page shows product names, it can be made to show password hashes instead.
- **Extracting data one bit at a time (blind injection).** When the page shows no query output, only "works" or "error", the attacker asks yes-or-no questions: "is the first letter of the admin password greater than m?" The page's behaviour answers. Slow, fully automatable, and it recovers the whole database.
- **Time-based blind.** When even the error is hidden, the attacker makes the database sleep for five seconds when the answer is yes. The response time is the leak.
- **Writing, not just reading.** On a query you can influence that is not a `SELECT`, injection can change or delete data, and in some configurations run commands on the database host.

The point is not to enumerate payloads. It is that a single unparameterised query is not a small bug. It is, very often, the whole database.

## 3. The fixes that do not work

Because the bug is so old, there is a graveyard of tempting non-solutions. Know why each fails, because you will be offered all of them.

**Blocklisting bad words.** "Reject any input containing `SELECT`, `UNION`, `--`." This fails immediately: SQL has many equivalent spellings, comments can be inline (`/**/`), keywords can be case-varied and split, and encodings multiply the surface. You cannot enumerate every dangerous string, and the day you miss one, you are breached. Blocklists are a losing game in every area of security.

**Escaping quotes by hand.** "Replace every `'` with `''`." This is the right idea done in the wrong place, and it is riddled with edge cases: numeric contexts where no quotes are involved, backslash escaping that differs by database, multi-byte character tricks that smuggle a quote past a naive replace. You will get it subtly wrong, and subtly wrong is breached.

**Stored procedures, by themselves.** A stored procedure that itself builds a query by concatenation is exactly as vulnerable. The procedure boundary changes nothing if the concatenation moved inside it.

All three share a flaw: they try to make hostile data safe while still sending it down the code channel. The winning move is to not send it down the code channel at all.

## 4. The fix that works: parameterised queries

Hand the database two separate things: the query, with placeholders, and the values. The database compiles the query first, as a fixed program with holes, and then drops the values into the holes as pure data. A value can never be parsed as SQL, because by the time the value arrives, parsing is already done.

```sql
-- the query, sent once, with a hole
SELECT * FROM users WHERE username = ? AND password_hash = ?;
```

In the application, the values go through a separate argument channel:

```pseudo
  db.execute(
      "SELECT * FROM users WHERE username = ? AND password_hash = ?",
      [username, password_hash]     // data, never concatenated into the query
  );
```

Now the earlier attack does nothing. If the username is `admin' --`, the database looks for a user whose name is literally the seven characters `admin' --`, finds none, and the login fails. The quote and the comment are just characters in a string, because the string arrived as data and there was never a moment when it could be anything else.

This is called a parameterised query or a prepared statement, and every database driver in every language has it. The rule is absolute and worth stating without hedging:

> **Never build a query by putting a variable into the query string. Ever. Use placeholders and pass the values separately, every single time.**

Note what is *not* the mechanism. Parameterisation is not "the driver escapes the values for you". It is that the values never touch the SQL parser at all. That distinction is why it is airtight where escaping is not.

## 5. The one place placeholders do not reach, and what to do

Placeholders work for *values*: things in a `WHERE`, an `INSERT`, a `LIMIT`. They cannot parameterise *identifiers*: a table name, a column name, or the direction of an `ORDER BY`, because those are part of the query's structure, not its data. So this does not work:

```pseudo
  db.execute("SELECT * FROM ? WHERE ...", [tableName]);   // not allowed
```

When you genuinely need a dynamic table or column name, and you should first ask whether you really do, you cannot pass it as a parameter. Here, and only here, you fall back to an **allowlist**: the input must be one of a fixed, known set of names you control.

```pseudo
  const allowed = { "date": "created_at", "name": "display_name" };
  const column = allowed[userSortKey];        // look it up, never use it raw
  if (!column) throw new Error("bad sort key");
  // now `column` is a string YOU wrote, safe to concatenate
```

The value crossing the boundary is used only to *select* from names you defined; it never becomes a name itself. That is the allowlist principle, and it is the correct tool whenever the dangerous thing is structural rather than a value.

## 6. Use an ORM, but understand it

Most real code does not write SQL by hand; it uses an object-relational mapper or a query builder, and these parameterise by default. That is a genuine reason they are safer. But two cautions.

First, most ORMs have an escape hatch for raw SQL, and the moment you use it with string concatenation, you are back to square one with none of the protection. `raw("SELECT ... WHERE id = " + userId)` is a SQL injection inside an ORM.

Second, some query builders let you pass raw fragments for ordering or filtering, and those fragments are not parameterised. Read your ORM's documentation specifically for where it stops protecting you. The protection is real but it has edges, and the edges are where the bugs are.

## 7. Defence in depth: what to do beyond the query

Parameterisation stops the injection. The rest is limiting the blast radius for the day something slips through, because defence in depth means no single failure is catastrophic.

- **Least privilege for the database account.** The account your application connects with should be able to do exactly what the application needs and nothing else. If the web app only reads and writes its own tables, its database user should not be able to drop tables or read the system catalogue. Then an injection that gets through can still only reach what that account could reach.
- **Do not expose raw database errors.** An error message that echoes the failing SQL hands the attacker a map. Log the detail server-side; show the user a generic failure.
- **Validate input for shape anyway.** Parameterisation makes injection impossible, but a user id that should be a number should still be rejected if it is not one. This is not your injection defence, but it catches a class of logic bugs and narrows what reaches the query.
- **A web application firewall is a speed bump, not a fix.** It can slow down automated scanning, but it is a blocklist by another name and it is bypassable. Never let its presence excuse an unparameterised query.

The ordering matters: the query fix is the wall, and everything in this section is what stands behind the wall in case a brick is loose.

## The short version

- SQL injection is data becoming code: user input concatenated into a query string is parsed as SQL, so the attacker writes part of your query. A login `admin' --` comments the password check away.
- One unparameterised query is often the whole database: `UNION` reads other tables, blind and time-based techniques extract it a bit at a time, and some setups allow writes and command execution.
- The fixes that fail all try to sanitise hostile data while still sending it down the code channel: blocklists, hand escaping, and stored procedures that themselves concatenate.
- The fix that works is the parameterised query: send the query with placeholders and the values separately, so the values never reach the SQL parser. Never put a variable into a query string, ever.
- Placeholders are for values, not identifiers. For a dynamic table or column name, use an allowlist of names you control; the input only selects, it never becomes the name.
- ORMs parameterise by default and are safer for it, but their raw-SQL escape hatches and unparameterised ordering fragments are where injection sneaks back in.
- Behind the wall: least-privilege database accounts, no raw error messages, shape validation, and no faith in a web application firewall.

Next: cross-site scripting, the same bug moved from the database to the browser, where the code that gets injected runs in your users' sessions.
