const alphabet = "abcdefghijklmnopqrstuvwxyzåäö";
const colorCycle = ["gray", "yellow", "green"];
const storageKey = "ordligen.appState.v1";
const stateNames = {
  green: "Grön",
  yellow: "Gul",
  gray: "Grå",
};
const modeNames = {
  words: "Alla möjliga ord",
  letter: "Troligaste bokstav",
  position: "Bokstav + placering",
  yellow: "Placering av gul bokstav",
  guess: "Bästa nästa gissning",
  freshGuess: "Gissning med nya bokstäver",
};

const state = {
  length: 5,
  mode: "words",
  guesses: [newGuess()],
  search: "",
  wordsByLength: new Map(),
  candidates: [],
};

const guessList = document.querySelector("#guess-list");
const results = document.querySelector("#results");
const resultCount = document.querySelector("#result-count");
const listStatus = document.querySelector("#list-status");
const modeSummary = document.querySelector(".mode-summary");
const storageStatus = document.querySelector("#storage-status");

function showStorageWarning(message) {
  storageStatus.textContent = message;
  storageStatus.hidden = false;
}

function restoreSavedState() {
  let saved;
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return;
    saved = JSON.parse(raw);
  } catch {
    showStorageWarning("Det gick inte att läsa ditt sparade tillstånd från webbläsaren.");
    return;
  }

  const validLength = saved?.length === 5 || saved?.length === 6;
  const validMode = Object.hasOwn(modeNames, saved?.mode);
  const validGuesses =
    Array.isArray(saved?.guesses) &&
    saved.guesses.length > 0 &&
    saved.guesses.every(
      (guess) =>
        Array.isArray(guess.letters) &&
        Array.isArray(guess.marks) &&
        guess.letters.length === saved.length &&
        guess.marks.length === saved.length &&
        guess.letters.every(
          (letter) =>
            typeof letter === "string" && (letter === "" || isLetter(letter)),
        ) &&
        guess.marks.every((mark) => colorCycle.includes(mark)),
    );
  if (!validLength || !validMode || !validGuesses || typeof saved.search !== "string") {
    showStorageWarning("Det sparade tillståndet kunde inte läsas. Börjar med en ny omgång.");
    return;
  }

  state.length = saved.length;
  state.mode = saved.mode;
  state.guesses = saved.guesses.map((guess) => ({
    letters: guess.letters.map((letter) => letter.toLocaleLowerCase("sv")),
    marks: guess.marks.map((mark, position) =>
      guess.letters[position] ? mark : "gray",
    ),
  }));
  state.search = saved.search;
}

function saveState() {
  try {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        length: state.length,
        mode: state.mode,
        guesses: state.guesses,
        search: state.search,
      }),
    );
  } catch {
    showStorageWarning("Det gick inte att spara tillståndet i webbläsaren.");
  }
}

function newGuess(length = 5) {
  return {
    letters: Array.from({ length }, () => ""),
    marks: Array.from({ length }, () => "gray"),
  };
}

function isLetter(value) {
  return value.length === 1 && alphabet.includes(value.toLocaleLowerCase("sv"));
}

function isGuessComplete(guess) {
  return guess.letters.length === state.length && guess.letters.every(isLetter);
}

function cycleMark(guess, position, tile, direction = 1) {
  if (!isLetter(guess.letters[position])) {
    guess.marks[position] = "gray";
    tile.dataset.state = "gray";
    const rowIndex = Number(tile.closest(".guess-row").dataset.row);
    tile.querySelector(".letter-input").setAttribute(
      "aria-label",
      `Gissning ${rowIndex + 1}, bokstav ${position + 1}, grå`,
    );
    return;
  }
  const currentIndex = colorCycle.indexOf(guess.marks[position]);
  const nextIndex = (currentIndex + direction + colorCycle.length) % colorCycle.length;
  guess.marks[position] = colorCycle[nextIndex];
  tile.dataset.state = guess.marks[position];
  const rowIndex = Number(tile.closest(".guess-row").dataset.row);
  tile.querySelector(".letter-input").setAttribute(
    "aria-label",
    `Gissning ${rowIndex + 1}, bokstav ${position + 1}, ${stateNames[guess.marks[position]].toLocaleLowerCase("sv")}`,
  );
  updateResults();
}

function renderGuessRows() {
  guessList.replaceChildren();

  state.guesses.forEach((guess, rowIndex) => {
    const row = document.createElement("div");
    row.className = "guess-row";
    row.dataset.row = String(rowIndex);

    const main = document.createElement("div");
    main.className = "guess-row-main";
    const heading = document.createElement("div");
    heading.className = "guess-row-heading";

    const label = document.createElement("strong");
    label.textContent = `Gissning ${rowIndex + 1}`;
    const hint = document.createElement("span");
    hint.textContent = "Klicka, ↑ framåt eller ↓ bakåt för att byta färg";
    heading.append(label, hint);

    const tiles = document.createElement("div");
    tiles.className = "tiles";
    tiles.setAttribute("role", "group");
    tiles.setAttribute("aria-label", `Bokstäver och feedback för gissning ${rowIndex + 1}`);

    for (let position = 0; position < state.length; position += 1) {
      const tile = document.createElement("div");
      tile.className = "letter-tile";
      tile.dataset.state = guess.marks[position];

      const input = document.createElement("input");
      input.className = "letter-input";
      input.type = "text";
      input.maxLength = 1;
      input.autocomplete = "off";
      input.spellcheck = false;
      input.value = guess.letters[position].toLocaleUpperCase("sv");
      input.placeholder = String(position + 1);
      input.setAttribute(
        "aria-label",
        `Gissning ${rowIndex + 1}, bokstav ${position + 1}, ${stateNames[guess.marks[position]].toLocaleLowerCase("sv")}`,
      );
      input.setAttribute("aria-describedby", "tile-feedback-help");
      input.addEventListener("input", (event) => {
        const entered = [...event.target.value]
          .map((letter) => letter.toLocaleLowerCase("sv"))
          .filter(isLetter);
        const letter = entered.at(-1) ?? "";
        guess.letters[position] = letter;
        event.target.value = letter.toLocaleUpperCase("sv");
        if (letter && position < state.length - 1) {
          row.querySelectorAll(".letter-input")[position + 1]?.focus();
        }
        updateResults();
      });
      input.addEventListener("keydown", (event) => {
        if (event.key === "Backspace" && !input.value && position > 0) {
          row.querySelectorAll(".letter-input")[position - 1]?.focus();
        }
        if (event.key === "ArrowLeft" && position > 0) {
          event.preventDefault();
          row.querySelectorAll(".letter-input")[position - 1]?.focus();
        }
        if (event.key === "ArrowRight" && position < state.length - 1) {
          event.preventDefault();
          row.querySelectorAll(".letter-input")[position + 1]?.focus();
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          cycleMark(guess, position, tile);
        }
        if (event.key === "ArrowDown") {
          event.preventDefault();
          cycleMark(guess, position, tile, -1);
        }
      });
      tile.addEventListener("click", (event) => {
        if (event.target.closest("button")) return;
        input.focus();
        cycleMark(guess, position, tile);
      });

      tile.append(input);
      tiles.append(tile);
    }

    main.append(heading, tiles);
    row.append(main);

    if (state.guesses.length > 1) {
      const removeButton = document.createElement("button");
      removeButton.className = "remove-guess";
      removeButton.type = "button";
      removeButton.textContent = "×";
      removeButton.setAttribute("aria-label", `Ta bort gissning ${rowIndex + 1}`);
      removeButton.addEventListener("click", () => {
        state.guesses.splice(rowIndex, 1);
        renderGuessRows();
        updateResults();
      });
      row.append(removeButton);
    } else {
      const spacer = document.createElement("span");
      spacer.setAttribute("aria-hidden", "true");
      row.append(spacer);
    }

    guessList.append(row);
  });
}

function selectedGuesses() {
  return state.guesses
    .map((guess) => ({
      letters: guess.letters,
      marks: guess.marks,
    }))
    .filter(
      (guess) =>
        isGuessComplete(guess),
    );
}

function feedbackFor(guess, answer) {
  const marks = Array.from({ length: state.length }, () => "gray");
  const remaining = new Map();

  for (let position = 0; position < state.length; position += 1) {
    if (guess[position] === answer[position]) {
      marks[position] = "green";
    } else {
      remaining.set(answer[position], (remaining.get(answer[position]) ?? 0) + 1);
    }
  }

  for (let position = 0; position < state.length; position += 1) {
    if (marks[position] === "green") continue;
    const count = remaining.get(guess[position]) ?? 0;
    if (count > 0) {
      marks[position] = "yellow";
      remaining.set(guess[position], count - 1);
    }
  }

  return marks;
}

function matchesClues(answer, guesses) {
  return guesses.every((guess) => {
    const actual = feedbackFor(guess.letters.join(""), answer);
    return guess.marks.every(
      (mark, position) => mark === actual[position],
    );
  });
}

function candidateWords() {
  const guesses = selectedGuesses();
  return state.wordsByLength.get(state.length).filter((word) => {
    return matchesClues(word, guesses);
  });
}

function renderWords(candidates) {
  results.replaceChildren();

  const search = document.createElement("input");
  search.className = "search-input search-wrap";
  search.type = "search";
  search.placeholder = "Sök bland möjliga ord…";
  search.autocomplete = "off";
  search.value = state.search;
  search.setAttribute("aria-label", "Filtrera listan med möjliga ord");
  search.addEventListener("input", () => {
    state.search = search.value.toLocaleLowerCase("sv").trim();
    saveState();
    renderWords(candidates);
  });

  const filtered = candidates.filter((word) => word.includes(state.search));
  const list = document.createElement("div");
  list.className = "word-list";
  const shown = filtered.slice(0, 240);
  for (const word of shown) {
    const chip = document.createElement("button");
    chip.className = "word-chip";
    chip.type = "button";
    chip.textContent = word.toLocaleUpperCase("sv");
    chip.title = "Använd som nästa gissning";
    chip.addEventListener("click", () => addSuggestedGuess(word));
    list.append(chip);
  }

  const footnote = document.createElement("p");
  footnote.className = "result-footnote";
  footnote.textContent =
    filtered.length > shown.length
      ? `Visar ${shown.length} av ${filtered.length}. Sök för att begränsa listan. Klicka på ett ord för att lägga till en gissning.`
      : "Klicka på ett ord för att fylla i den senaste ofullständiga gissningen eller lägga till en ny.";

  results.append(search);
  if (filtered.length === 0) {
    results.append(emptyMessage("Inga ord matchar sökningen och ledtrådarna."));
    return;
  }
  results.append(list, footnote);
}

function emptyMessage(message) {
  const empty = document.createElement("p");
  empty.className = "empty-state";
  empty.textContent = message;
  return empty;
}

function rankCounts(counts) {
  return [...counts.entries()]
    .filter(([, count]) => count > 0)
    .sort(
      ([letterA, countA], [letterB, countB]) =>
        countB - countA || alphabet.indexOf(letterA) - alphabet.indexOf(letterB),
    );
}

function appendMeter(element, ratio) {
  const meter = document.createElement("div");
  meter.className = "recommendation-meter";
  const fill = document.createElement("span");
  fill.style.width = `${Math.max(3, ratio * 100)}%`;
  meter.append(fill);
  element.append(meter);
}

function renderLetterRecommendations(candidates) {
  const counts = new Map();
  const triedLetters = new Set(
    selectedGuesses().flatMap((guess) => guess.letters),
  );
  for (const word of candidates) {
    for (const letter of new Set(word)) {
      if (triedLetters.has(letter)) continue;
      counts.set(letter, (counts.get(letter) ?? 0) + 1);
    }
  }

  const ranked = rankCounts(counts);
  if (!ranked.length) {
    results.replaceChildren(
      emptyMessage("Inga nya bokstäver återstår att rekommendera bland de möjliga orden."),
    );
    return;
  }

  const list = document.createElement("div");
  list.className = "recommendation-list";
  const maximum = ranked[0][1];
  for (const [index, [letter, count]] of ranked.slice(0, 12).entries()) {
    const row = document.createElement("div");
    row.className = "recommendation";
    const rank = document.createElement("span");
    rank.className = "recommendation-rank";
    rank.textContent = `#${index + 1}`;
    const label = document.createElement("div");
    label.className = "recommendation-label";
    label.textContent = letter.toLocaleUpperCase("sv");
    appendMeter(label, count / maximum);
    const detail = document.createElement("span");
    detail.className = "recommendation-detail";
    detail.textContent = `${count} av ${candidates.length} ord · ${Math.round((count / candidates.length) * 100)} %`;
    row.append(rank, label, detail);
    list.append(row);
  }
  results.replaceChildren(list);
}

function renderPositionRecommendations(candidates) {
  const counts = Array.from({ length: state.length }, () => new Map());
  const triedLetters = new Set(
    selectedGuesses().flatMap((guess) => guess.letters),
  );
  const fixedPositions = new Set(
    selectedGuesses().flatMap((guess) =>
      guess.marks.flatMap((mark, position) => (mark === "green" ? [position] : [])),
    ),
  );
  for (const word of candidates) {
    for (let position = 0; position < state.length; position += 1) {
      if (fixedPositions.has(position) || triedLetters.has(word[position])) continue;
      const letter = word[position];
      counts[position].set(letter, (counts[position].get(letter) ?? 0) + 1);
    }
  }

  const ranked = [];
  counts.forEach((positionCounts, position) => {
    for (const [letter, count] of positionCounts) {
      ranked.push({ letter, count, position });
    }
  });
  ranked.sort(
    (a, b) =>
      b.count - a.count ||
      alphabet.indexOf(a.letter) - alphabet.indexOf(b.letter) ||
      a.position - b.position,
  );

  if (!ranked.length) {
    results.replaceChildren(
      emptyMessage("Inga nya bokstäver och placeringar återstår att rekommendera."),
    );
    return;
  }

  const maximum = ranked[0].count;
  const list = document.createElement("div");
  list.className = "recommendation-list";
  for (const [index, item] of ranked.slice(0, 12).entries()) {
    const row = document.createElement("div");
    row.className = "recommendation";
    const rank = document.createElement("span");
    rank.className = "recommendation-rank";
    rank.textContent = `#${index + 1}`;
    const label = document.createElement("div");
    label.className = "recommendation-label";
    label.textContent = item.letter.toLocaleUpperCase("sv");
    appendMeter(label, item.count / maximum);
    const detail = document.createElement("span");
    detail.className = "recommendation-detail";
    detail.textContent = `Plats ${item.position + 1} · ${item.count} av ${candidates.length} ord`;
    row.append(rank, label, detail);
    list.append(row);
  }
  results.replaceChildren(list);
}

function yellowClues() {
  const letters = new Map();
  for (const guess of selectedGuesses()) {
    guess.letters.forEach((letter, position) => {
      if (!letter || guess.marks[position] !== "yellow") return;
      const forbidden = letters.get(letter) ?? new Set();
      forbidden.add(position);
      letters.set(letter, forbidden);
    });
  }
  return letters;
}

function renderYellowRecommendations(candidates) {
  const clues = yellowClues();
  if (!clues.size) {
    results.replaceChildren(
      emptyMessage("Markera minst en bokstav som gul i en gissning för att se var den kan passa."),
    );
    return;
  }
  if (!candidates.length) {
    results.replaceChildren(emptyMessage("Det finns inga möjliga ord att analysera."));
    return;
  }

  const list = document.createElement("div");
  list.className = "recommendation-list";
  for (const [letter, forbiddenPositions] of clues) {
    const positionCounts = Array.from({ length: state.length }, () => 0);
    for (const word of candidates) {
      for (let position = 0; position < state.length; position += 1) {
        if (word[position] === letter && !forbiddenPositions.has(position)) {
          positionCounts[position] += 1;
        }
      }
    }

    const possiblePositions = positionCounts
      .map((count, position) => ({ count, position }))
      .filter(({ count, position }) => count > 0 && !forbiddenPositions.has(position))
      .sort((a, b) => b.count - a.count || a.position - b.position);
    if (!possiblePositions.length) continue;

    const maximum = possiblePositions[0].count;
    const row = document.createElement("div");
    row.className = "recommendation yellow-recommendation";
    const rank = document.createElement("span");
    rank.className = "recommendation-rank";
    rank.textContent = "→";
    const label = document.createElement("div");
    label.className = "recommendation-label";
    label.textContent = letter.toLocaleUpperCase("sv");
    const bars = document.createElement("div");
    bars.className = "position-bars";
    bars.setAttribute("aria-label", "Relativ sannolikhet för varje tillåten placering");
    positionCounts.forEach((count, position) => {
      const bar = document.createElement("div");
      bar.className = "position-bar";
      const fill = document.createElement("span");
      fill.style.width = forbiddenPositions.has(position)
        ? "0%"
        : `${count ? Math.max(4, (count / maximum) * 100) : 0}%`;
      bar.append(fill);
      bar.title = `${position + 1}: ${count} möjliga ord`;
      bars.append(bar);
    });
    const detail = document.createElement("span");
    detail.className = "recommendation-detail";
    detail.textContent = possiblePositions
      .slice(0, 3)
      .map(({ position, count }) => `${position + 1}: ${count}`)
      .join(" · ");
    row.append(rank, label, bars, detail);
    list.append(row);
  }

  if (!list.childElementCount) {
    results.replaceChildren(emptyMessage("Ingen möjlig placering hittades för de gula bokstäverna."));
    return;
  }
  results.replaceChildren(list);
}

function rankGuessRecommendations(candidates, avoidPreviousLetters = false) {
  const wordList = state.wordsByLength.get(state.length);
  const previousGuesses = selectedGuesses();
  const alreadyGuessed = new Set(previousGuesses.map((guess) => guess.letters.join("")));
  const previousLetters = new Set(previousGuesses.flatMap((guess) => guess.letters));
  const possibleGuesses = wordList.filter(
    (word) =>
      !alreadyGuessed.has(word) &&
      (!avoidPreviousLetters || [...word].every((letter) => !previousLetters.has(letter))),
  );

  if (!possibleGuesses.length) return [];

  const letterAtLeastCounts = new Map(
    [...alphabet].map((letter) => [letter, Array(state.length + 1).fill(0)]),
  );
  const positionCounts = Array.from({ length: state.length }, () => new Map());

  for (const answer of candidates) {
    const counts = new Map();
    for (let position = 0; position < state.length; position += 1) {
      const letter = answer[position];
      counts.set(letter, (counts.get(letter) ?? 0) + 1);
      positionCounts[position].set(
        letter,
        (positionCounts[position].get(letter) ?? 0) + 1,
      );
    }

    for (const [letter, count] of counts) {
      const atLeast = letterAtLeastCounts.get(letter);
      for (let occurrence = 1; occurrence <= count; occurrence += 1) {
        atLeast[occurrence] += 1;
      }
    }
  }

  const ranked = possibleGuesses.map((word) => {
    const guessCounts = new Map();
    let greenTotal = 0;
    for (let position = 0; position < state.length; position += 1) {
      const letter = word[position];
      guessCounts.set(letter, (guessCounts.get(letter) ?? 0) + 1);
      greenTotal += positionCounts[position].get(letter) ?? 0;
    }

    let matchedTotal = 0;
    for (const [letter, count] of guessCounts) {
      const atLeast = letterAtLeastCounts.get(letter);
      for (let occurrence = 1; occurrence <= count; occurrence += 1) {
        matchedTotal += atLeast[occurrence];
      }
    }

    return {
      word,
      green: greenTotal / candidates.length,
      yellow: (matchedTotal - greenTotal) / candidates.length,
      total: matchedTotal / candidates.length,
    };
  });

  return ranked.sort(
    (a, b) =>
      b.total - a.total ||
      b.green - a.green ||
      a.word.localeCompare(b.word, "sv"),
  );
}

function renderGuessRecommendations(candidates, avoidPreviousLetters = false) {
  const ranked = rankGuessRecommendations(candidates, avoidPreviousLetters);
  if (!ranked.length) {
    results.replaceChildren(
      emptyMessage(
        avoidPreviousLetters
          ? "Det finns inga ord kvar utan bokstäver från tidigare gissningar."
          : "Det finns inga nya gissningar att föreslå.",
      ),
    );
    return;
  }

  const intro = document.createElement("p");
  intro.className = "result-footnote guess-recommendation-intro";
  intro.textContent = avoidPreviousLetters
    ? "Förslagen använder inga bokstäver från tidigare kompletta gissningar. Visar snitt per gissning om varje möjligt svar är lika troligt; fler gröna + gula prioriteras, med fler gröna först vid lika resultat. Dubbla bokstäver räknas enligt färgreglerna."
    : "Visar snitt per gissning om varje möjligt svar är lika troligt. Rangordnat efter gröna + gula rutor; vid lika resultat prioriteras fler gröna. Dubbla bokstäver räknas enligt färgreglerna. Klicka på ett ord för att fylla nästa gissning.";

  const list = document.createElement("div");
  list.className = "recommendation-list";
  const maximum = ranked[0].total;
  for (const [index, recommendation] of ranked.slice(0, 20).entries()) {
    const row = document.createElement("div");
    row.className = "recommendation guess-recommendation";

    const rank = document.createElement("span");
    rank.className = "recommendation-rank";
    rank.textContent = `#${index + 1}`;

    const wordButton = document.createElement("button");
    wordButton.className = "guess-recommendation-word";
    wordButton.type = "button";
    wordButton.textContent = recommendation.word.toLocaleUpperCase("sv");
    wordButton.title = "Använd som nästa gissning";
    wordButton.addEventListener("click", () => addSuggestedGuess(recommendation.word));

    const metrics = document.createElement("div");
    metrics.className = "guess-recommendation-metrics";
    const score = document.createElement("strong");
    score.textContent = `${recommendation.total.toFixed(2)} träffar`;
    const breakdown = document.createElement("span");
    breakdown.textContent = `${recommendation.green.toFixed(2)} gröna · ${recommendation.yellow.toFixed(2)} gula`;
    appendMeter(metrics, recommendation.total / maximum);
    metrics.prepend(score, breakdown);

    row.append(rank, wordButton, metrics);
    list.append(row);
  }

  results.replaceChildren(intro, list);
}

function renderResults(candidates) {
  resultCount.textContent = `${candidates.length} möjliga`;
  modeSummary.textContent = modeNames[state.mode];

  if (!candidates.length) {
    results.replaceChildren(emptyMessage("Inga ord matchar ledtrådarna. Kontrollera färgerna."));
    return;
  }

  switch (state.mode) {
    case "letter":
      renderLetterRecommendations(candidates);
      break;
    case "position":
      renderPositionRecommendations(candidates);
      break;
    case "yellow":
      renderYellowRecommendations(candidates);
      break;
    case "guess":
      renderGuessRecommendations(candidates);
      break;
    case "freshGuess":
      renderGuessRecommendations(candidates, true);
      break;
    default:
      renderWords(candidates);
  }
}

function updateResults() {
  saveState();
  if (!state.wordsByLength.has(state.length)) return;
  state.candidates = candidateWords();
  renderResults(state.candidates);
}

function addSuggestedGuess(word) {
  let rowIndex = state.guesses.length - 1;
  let guess = state.guesses[rowIndex];
  if (isGuessComplete(guess)) {
    guess = newGuess(state.length);
    state.guesses.push(guess);
    rowIndex += 1;
  }
  guess.letters = [...word];
  renderGuessRows();
  updateResults();
  guessList.children[rowIndex]?.querySelector(".letter-input")?.focus();
}

async function loadWords(length) {
  if (state.wordsByLength.has(length)) return state.wordsByLength.get(length);
  const response = await fetch(`./data/words-${length}.txt`);
  if (!response.ok) {
    throw new Error(`Kunde inte läsa ordlistan (${response.status}).`);
  }
  const text = await response.text();
  const words = text
    .split(/\r?\n/u)
    .map((word) => word.trim().toLocaleLowerCase("sv"))
    .filter(
      (word) =>
        [...word].length === length &&
        [...word].every((letter) => alphabet.includes(letter)),
    );
  if (!words.length) {
    throw new Error("Ordlistan saknar ord med rätt längd.");
  }
  state.wordsByLength.set(length, words);
  return words;
}

async function setLength(length) {
  const lengthChanged = state.length !== length;
  state.length = length;
  if (lengthChanged) {
    state.guesses = [newGuess(length)];
    state.search = "";
  }
  document.querySelectorAll(".length-option").forEach((button) => {
    const isActive = Number(button.dataset.length) === length;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
  document.querySelectorAll(".mode-option").forEach((button) => {
    const isActive = button.dataset.mode === state.mode;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
  renderGuessRows();
  focusFirstEmptyLetter();
  listStatus.textContent = `Laddar ${length}-bokstavslistan…`;

  try {
    const words = await loadWords(length);
    if (state.length !== length) return;
    listStatus.textContent = `${words.length.toLocaleString("sv")} ord i listan`;
    updateResults();
  } catch (error) {
    if (state.length !== length) return;
    listStatus.textContent = error.message;
    listStatus.classList.add("error-text");
    results.replaceChildren(emptyMessage("Ordlistan kunde inte laddas. Starta appen via scripts/serve_app.py."));
    resultCount.textContent = "Fel";
  }
}

function focusFirstEmptyLetter() {
  const inputs = [...guessList.querySelectorAll(".letter-input")];
  const firstEmpty = inputs.find((input) => !input.value) ?? inputs[0];
  firstEmpty?.focus();
}

document.querySelector("#add-guess").addEventListener("click", () => {
  state.guesses.push(newGuess(state.length));
  renderGuessRows();
  updateResults();
  guessList.lastElementChild?.querySelector(".letter-input")?.focus();
});

document.querySelector("#clear-clues").addEventListener("click", () => {
  state.guesses = [newGuess(state.length)];
  state.search = "";
  renderGuessRows();
  updateResults();
});

document.querySelectorAll(".length-option").forEach((button) => {
  button.addEventListener("click", () => setLength(Number(button.dataset.length)));
});

document.querySelectorAll(".mode-option").forEach((button) => {
  button.addEventListener("click", () => {
    state.mode = button.dataset.mode;
    document.querySelectorAll(".mode-option").forEach((option) => {
      const isActive = option === button;
      option.classList.toggle("is-active", isActive);
      option.setAttribute("aria-pressed", String(isActive));
    });
    updateResults();
  });
});

restoreSavedState();
renderGuessRows();
setLength(state.length);
