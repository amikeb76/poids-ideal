const form = document.querySelector("#ideal-weight-form");
const idealWeightEl = document.querySelector("#ideal-weight");
const idealRangeEl = document.querySelector("#ideal-range");
const bmiEl = document.querySelector("#bmi");
const bmiStatusEl = document.querySelector("#bmi-status");
const differenceEl = document.querySelector("#difference");
const differenceTextEl = document.querySelector("#difference-text");
const formulaListEl = document.querySelector("#formula-list");

const round = (value, digits = 1) => Number(value.toFixed(digits));

function calculateIdealWeights(heightCm, sex) {
  const heightOver150 = Math.max(0, heightCm - 150);
  const heightOver152 = Math.max(0, heightCm - 152.4);
  const male = sex === "male";

  return {
    Lorentz: male
      ? heightCm - 100 - (heightCm - 150) / 4
      : heightCm - 100 - (heightCm - 150) / 2.5,
    Devine: (male ? 50 : 45.5) + 2.3 * (heightOver152 / 2.54),
    Robinson: (male ? 52 : 49) + (male ? 1.9 : 1.7) * (heightOver152 / 2.54),
    Miller: (male ? 56.2 : 53.1) + 1.41 * (heightOver152 / 2.54),
    Broca: heightCm - 100 - (male ? 0 : 5) + heightOver150 * 0.05,
  };
}

function getBmiStatus(bmi) {
  if (bmi < 18.5) {
    return { text: "Poids insuffisant", className: "status-low" };
  }

  if (bmi < 25) {
    return { text: "Zone consideree normale", className: "status-ok" };
  }

  if (bmi < 30) {
    return { text: "Surpoids possible", className: "status-high" };
  }

  return { text: "Obesite possible", className: "status-high" };
}

function renderResults() {
  const data = new FormData(form);
  const heightCm = Number(data.get("height"));
  const weightKg = Number(data.get("weight"));
  const sex = data.get("sex");
  const heightM = heightCm / 100;

  if (!heightCm || !weightKg || heightCm <= 0 || weightKg <= 0) {
    return;
  }

  const formulas = calculateIdealWeights(heightCm, sex);
  const values = Object.values(formulas).filter(Number.isFinite);
  const average = values.reduce((total, value) => total + value, 0) / values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const bmi = weightKg / (heightM * heightM);
  const diff = weightKg - average;
  const status = getBmiStatus(bmi);

  idealWeightEl.textContent = `${round(average)} kg`;
  idealRangeEl.textContent = `Entre ${round(min)} et ${round(max)} kg selon les formules`;
  bmiEl.textContent = round(bmi);
  bmiStatusEl.textContent = status.text;
  bmiStatusEl.className = status.className;
  differenceEl.textContent = `${diff > 0 ? "+" : ""}${round(diff)} kg`;
  differenceTextEl.textContent =
    Math.abs(diff) < 1
      ? "Tres proche de l'estimation"
      : diff > 0
        ? "Au-dessus de l'estimation"
        : "En-dessous de l'estimation";

  formulaListEl.innerHTML = Object.entries(formulas)
    .map(
      ([name, value]) => `
        <div>
          <dt>${name}</dt>
          <dd>${round(value)} kg</dd>
        </div>
      `
    )
    .join("");
}

form.addEventListener("input", renderResults);
renderResults();
