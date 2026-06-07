/*
 * Current-term course list — source of data for the Course List page.
 *
 * This is the "pull current term courses from my.wgu.edu" step, done by hand
 * from a screenshot of your Degree Plan / current term in the WGU portal.
 * my.wgu.edu has no public API and sits behind your student login, so there is
 * nothing to scrape server-side — instead, update this file each term.
 *
 * Each course:
 *   code   - WGU course code, e.g. "C952"            (required)
 *   title  - Course title                            (required)
 *   units  - Competency Units (CUs)                  (optional, number)
 *   status - "In Progress" | "Not Started" | "Completed" | "Enrolled" | ...
 *   link   - relative path to local study guides (e.g. "../c952/") OR an
 *            external my.wgu.edu URL. Omit for a non-clickable card.
 *   note   - short description shown under the title (optional)
 */
window.COURSES = {
  term: "Current Term",
  // Optional human-readable term window, e.g. "Jul 1 – Dec 31, 2026". Leave "" to hide.
  termWindow: "",
  // units (CUs) and status are left blank where unconfirmed — fill them in
  // from my.wgu.edu so the dashboard stays accurate rather than guessed.
  courses: [
    {
      code: "C952",
      title: "Computer Architecture",
      units: null,
      status: "In Progress",
      link: "../c952/",
      note: "zyBooks · LEGv8 / ARMv8 · study guides, mini-games & C952 Quest",
    },
    {
      code: "C958",
      title: "Calculus I",
      units: null,
      status: "",
      link: "",
      note: "",
    },
    {
      code: "D430",
      title: "Fundamentals of Information Security",
      units: null,
      status: "",
      link: "",
      note: "",
    },
    {
      code: "D281",
      title: "Linux Foundations",
      units: null,
      status: "",
      link: "",
      note: "",
    },
    {
      code: "C458",
      title: "Health, Fitness, and Wellness",
      units: null,
      status: "",
      link: "",
      note: "",
    },
    {
      code: "D336",
      title: "Business of IT – Applications",
      units: null,
      status: "",
      link: "",
      note: "",
    },
    {
      code: "D429",
      title: "Introduction to AI for Computer Scientists",
      units: null,
      status: "",
      link: "",
      note: "",
    },
  ],
};
