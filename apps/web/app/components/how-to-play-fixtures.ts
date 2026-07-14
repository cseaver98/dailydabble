import doodleTutorialPalmTree from "./doodle-tutorial-palm-tree.json";

export const VERBLE_TUTORIAL = {
  phrase: "Rome wasn't built in a day",
  wordGuess: "ADMIT",
  wordGuessFeedback: ["absent", "absent", "absent", "present", "correct"],
} as const;

export const EQUADLE_TUTORIAL = {
  answer: ["1", "2", "+", "8", "×", "7", "=", "6", "8"],
  incorrectGuess: ["1", "2", "×", "5", "+", "8", "=", "6", "8"],
  incorrectGuessFeedback: ["correct", "correct", "present", "absent", "present", "present", "locked", "target", "target"],
} as const;

export const DOODLE_TUTORIAL = doodleTutorialPalmTree;

export const SPORTLE_TUTORIAL = {
  answer: "LeBron James",
  clues: [
    {
      label: "Team",
      value: "Los Angeles Lakers",
      logoUrl: "https://upload.wikimedia.org/wikipedia/commons/3/3c/Los_Angeles_Lakers_logo.svg",
    },
    { label: "Years played for that team", value: "2018-present" },
    { label: "Position", value: "Forward" },
    { label: "Career", value: "4x NBA champion and 4x MVP" },
    { label: "Record", value: "NBA all-time points leader" },
    { label: "Final clue", value: "Also played for Cleveland and Miami" },
  ],
} as const;
