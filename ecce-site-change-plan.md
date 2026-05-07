# Ecce.me Site Direction and Change Plan

## What you want the site to be

`ecce.me` should be a **personal builder site**, not a stiff corporate portfolio.

Core intent:

- Document what you are learning and building.
- Feel personal enough to sound like you, not fake-professional.
- Stay professional enough that a recruiter, collaborator, or technical person can understand your skills.
- Track your CS degree progress, projects, and course reflections.
- Act as a writing/work log that keeps you focused while finishing school.
- Differentiate you from the average CS student by showing applied work, not just coursework.

---

## Things you said you wanted to include

### 1. Remaining WGU courses + progress tracker

Include a visible tracker showing:

- Completed courses
- In-progress courses
- Remaining courses
- Percentage complete
- Expected timeline to finish

This should show that you are moving quickly through a competency-based degree, not just casually enrolled.

---

### 2. Course postmortems / retrospectives

For each completed course, create a short reflection documenting:

- What the course covered
- What was actually useful
- What was annoying or inefficient
- What you learned
- How it connects to real projects or career goals
- What you would do differently
- Whether it created any project ideas

This should not read like a school assignment. It should read like a practical after-action review.

---

### 3. Weekly publishing, not daily publishing

Use this rhythm:

- Take short private notes while working on coursework/projects.
- Use those notes to publish one concise weekly post.
- Avoid the pressure of daily public posts.
- Use the site as accountability without turning it into a distraction.

---

### 4. Project documentation

Each project should include:

- What problem it solves
- What you built
- Tools/stack used
- Current status
- What you learned
- What is next
- GitHub link if available

---

### 5. GitHub integration

Add GitHub in a useful but simple way:

- GitHub profile button/link
- Project cards linking to repos
- Site code managed through GitHub
- Cloudflare Pages auto-deploying from GitHub

Do not overdo GitHub widgets early. Simple links are enough first.

---

### 6. About section with a real but not heavy narrative

Your rough narrative:

- You did not take college seriously at first.
- You dropped out or stopped more than once.
- You spent several years working Amazon delivery.
- That work gave you time and perspective to realize you wanted something more.
- You are now finishing your CS degree seriously and quickly.
- The tone should be honest, grounded, and light enough that it does not feel like trauma-branding.

The key: **briefly own the past, then pivot to what you are doing now.**

---

### 7. Explain WGU clearly

Explain that WGU is:

- Competency-based
- Regionally accredited
- Not a diploma mill
- Faster because you prove mastery instead of sitting through fixed semesters
- A good fit because you can move quickly through material you already understand or can learn aggressively

This probably belongs on an education page or coursework tracker page, not in the main hero.

---

### 8. Keep the site personal

Avoid sounding like:

- A LinkedIn influencer profile
- A corporate bio
- A motivational comeback story
- Startup buzzword copy
- Generic “passionate lifelong learner” filler

Preferred tone:

- Direct
- Plainspoken
- Specific
- Slightly personal
- Honest about unfinished/in-progress work
- Focused on proof

---

## Changes to make to the site

## Priority 1 — Fix obvious polish issues

### Change the homepage hero copy

Current direction is too vague:

> I build both digital and tangible things for the love of it.

Better direction:

```text
Hi, I’m Logan.

I’m a computer science student building practical software, automation tools, and physical systems.

This site is where I document what I’m learning, what I’m building, and how I’m turning scattered curiosity into finished work.
```

### Remove or fix broken icons/buttons

The broken icon/button near the bottom of the mobile screenshot should be fixed immediately. It makes the site feel unfinished.

### Confirm links work

Check:

- Resume button
- GitHub button
- X/Twitter button
- Any logo/home button
- Menu items
- Mobile menu

If a link is not ready, remove it temporarily.

---

## Priority 2 — Restructure the homepage

Recommended homepage sections:

```text
1. Hero
2. Featured Projects
3. Coursework Progress
4. Recent Course Retrospectives
5. Recent Writing / Work Log
6. About
7. Contact / Links
```

### Hero

Purpose: explain who you are in 5 seconds.

Include:

- Name
- CS student / builder identity
- Software + automation + physical systems
- Resume / GitHub / Projects buttons

### Featured Projects

Show 3–5 cards.

Each card:

```text
Project name
One-sentence summary
Status: In progress / Prototype / Complete
Stack: Hugo, Python, ESP32, etc.
Links: GitHub / Demo / Writeup
```

Possible project examples:

- Ecce.me site itself
- Coursework tracker
- Productivity tracker/PWA
- ESP32/Home Assistant presence system
- Embroidery workflow tools
- Smart hive/IoT experiments
- Automation scripts

### Coursework Progress

Use a clean tracker.

Example:

```text
WGU Computer Science Progress

Completed: 62%
Current: C952 Computer Architecture
Remaining: 11 courses
Target finish: 3–6 months
```

Then group courses:

```text
Completed
In Progress
Remaining
```

### Course Retrospectives

Show the latest 3.

Example titles:

```text
C952 Computer Architecture — What I Actually Needed to Learn
D281 Linux Foundations — Notes After Finishing
D287 Java Frameworks — What Was Useful, What Was Noise
```

### Recent Writing / Work Log

This is where weekly posts go.

Keep posts short. Not every post needs to be profound.

Types:

- Weekly build log
- Course notes
- Project progress
- What I fixed this week
- What I misunderstood
- What I’d do differently

### About

Short, grounded, non-corporate.

Avoid a long autobiography on the homepage. Link to a fuller About page if needed.

---

## Priority 3 — Add repeatable content structures

### Add a project template

Each project page should have:

```markdown
---
title:
summary:
status:
stack:
github:
demo:
date:
---

## Problem

## What I built

## What I learned

## Current status

## Next steps
```

### Add a course retrospective template

Each course page should have:

```markdown
---
title:
course_code:
status:
completed:
tags:
---

## What this course covered

## What was useful

## What was not useful

## How I studied it

## What I would do differently

## Practical takeaway

## Related projects or notes
```

### Add a weekly log template

Each weekly post should have:

```markdown
---
title:
date:
tags: ["weekly-log"]
---

## What I worked on

## What moved forward

## What got stuck

## What I learned

## Next week
```

---

## Priority 4 — Make the tone consistent

### Avoid

```text
passionate
multidisciplinary
journey
resilience
changing the world
driven individual
innovative solutions
lifelong learner
```

### Prefer

```text
I built
I’m learning
I tested
I fixed
I misunderstood
I changed
This worked
This did not work
Next I’m doing
```

The site should sound like someone who actually builds and reflects, not someone trying to impress HR.

---

## Priority 5 — Technical cleanup

### Use VS Code + Codex for controlled changes

Workflow:

```text
branch → small Codex task → local Hugo preview → build check → commit → push → Cloudflare deploy
```

### Add `AGENTS.md`

This tells Codex how to behave in your repo.

Key rules:

- Do not modify theme source unless asked.
- Prefer Hugo overrides.
- Keep mobile-first.
- Do not touch unrelated files.
- Keep tone grounded.
- Avoid corporate copy.
- Do not edit generated `public/` unless intentionally needed.

### Check `public/`

Decide whether `public/` should be committed. In most Cloudflare Pages + Hugo setups, it should be ignored because Cloudflare generates it during build.

### Install Hugo Extended

Your current Hugo did not show `+extended`. Since you use Blowfish/theme assets, use Hugo Extended to avoid Sass/CSS pipeline problems.

---

## Best order to do the changes

```text
1. Install/verify Hugo Extended
2. Make a new Git branch
3. Add AGENTS.md
4. Fix homepage hero copy
5. Fix broken icon/button
6. Confirm all buttons/links
7. Add Featured Projects placeholder section
8. Add Coursework Progress section
9. Add course retrospective template
10. Add first real course retrospective
11. Add first project page
12. Add weekly log structure
13. Refine styling only after content works
```

---

## Strategic goal

Your site should answer four questions quickly:

1. **Who are you?**  
   CS student and practical builder.

2. **What are you building?**  
   Software, automation tools, web projects, and physical/computing systems.

3. **What proof exists?**  
   Projects, GitHub, course retrospectives, progress tracker.

4. **Why are you different from an average CS student?**  
   You document your work, connect school to real systems, build outside coursework, and show a visible trail of progress.
