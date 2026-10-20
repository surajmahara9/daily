const STORAGE_KEY = "dailyExpenseTracker.v1";
const $ = (id) => document.getElementById(id);
let expenses = loadExpenses();
let editingId = null;
let toastTimer;

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function loadExpenses() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter(isValidExpense) : [];
  } catch {
    return [];
  }
}
function isValidExpense(item) {
  return (
    item &&
    typeof item.id === "string" &&
    typeof item.itemName === "string" &&
    Number.isFinite(Number(item.price)) &&
    Number(item.price) >= 0 &&
    Number.isFinite(Number(item.quantity)) &&
    Number(item.quantity) > 0 &&
    typeof item.date === "string"
  );
}
function saveExpenses() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
    return true;
  } catch {
    showToast("Could not save data. Check browser storage space.");
    return false;
  }
}
function money(value) {
  return (
    "Rs. " +
    Number(value || 0).toLocaleString("en-NP", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}
function escapeHTML(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (ch) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[ch],
  );
}
function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}
function getFilteredExpenses() {
  const term = $("search").value.trim().toLowerCase();
  const start = $("startDate").value;
  const end = $("endDate").value;
  return expenses
    .filter((item) => {
      const matchesText =
        !term ||
        item.itemName.toLowerCase().includes(term) ||
        (item.category || "").toLowerCase().includes(term) ||
        (item.notes || "").toLowerCase().includes(term);
      return (
        matchesText &&
        (!start || item.date >= start) &&
        (!end || item.date <= end)
      );
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
}
function render() {
  const today = localDateString();
  const month = today.slice(0, 7);
  const totalOf = (list) =>
    list.reduce(
      (sum, item) => sum + Number(item.price) * Number(item.quantity),
      0,
    );
  $("todayTotal").textContent = money(
    totalOf(expenses.filter((e) => e.date === today)),
  );
  $("monthTotal").textContent = money(
    totalOf(expenses.filter((e) => e.date.slice(0, 7) === month)),
  );
  $("allTotal").textContent = money(totalOf(expenses));

  const filtered = getFilteredExpenses();
  $("recordCount").textContent =
    `${filtered.length} record${filtered.length === 1 ? "" : "s"}`;
  $("emptyMessage").hidden = filtered.length > 0;
  $("expenseRows").innerHTML = filtered
    .map(
      (e) => `
    <tr>
      <td>${escapeHTML(e.date)}</td>
      <td><strong>${escapeHTML(e.itemName)}</strong></td>
      <td><span class="tag">${escapeHTML(e.category || "Other")}</span></td>
      <td>${money(e.price)}</td>
      <td>${escapeHTML(e.quantity)}</td>
      <td><strong>${money(Number(e.price) * Number(e.quantity))}</strong></td>
      <td>${escapeHTML(e.notes || "—")}</td>
      <td class="actions">
        <button type="button" class="small edit" data-action="edit" data-id="${escapeHTML(e.id)}">Edit</button>
        <button type="button" class="small danger" data-action="delete" data-id="${escapeHTML(e.id)}">Delete</button>
      </td>
    </tr>`,
    )
    .join("");
}
function readForm(prefix = "") {
  const get = (name) => $(prefix + name);
  const itemName = get("itemName").value.trim();
  const price = Number(get("price").value);
  const quantity = Number(get("quantity").value);
  if (
    !itemName ||
    get("price").value === "" ||
    !Number.isFinite(price) ||
    price < 0 ||
    !Number.isFinite(quantity) ||
    quantity <= 0
  ) {
    showToast("Enter a valid item name, price, and quantity.");
    return null;
  }
  return {
    itemName,
    price,
    quantity,
    category: get("category").value || "Other",
    date: get("purchaseDate").value,
    notes: get("notes").value.trim(),
  };
}
$("purchaseDate").value = localDateString();

$("expenseForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const data = readForm();
  if (!data || !data.date) {
    if (data) showToast("Please select a date.");
    return;
  }
  expenses.push({
    ...data,
    id: crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`,
    createdAt: Date.now(),
  });
  if (saveExpenses()) {
    $("expenseForm").reset();
    $("purchaseDate").value = localDateString();
    $("quantity").value = "1";
    $("category").value = "Food";
    render();
    showToast("Expense saved.");
  }
});

$("expenseRows").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const item = expenses.find((e) => e.id === button.dataset.id);
  if (!item) return;
  if (button.dataset.action === "delete") {
    if (!confirm(`Delete the expense "${item.itemName}"?`)) return;
    expenses = expenses.filter((e) => e.id !== item.id);
    if (saveExpenses()) {
      render();
      showToast("Expense deleted.");
    }
  } else {
    editingId = item.id;
    $("editName").value = item.itemName;
    $("editPrice").value = item.price;
    $("editQuantity").value = item.quantity;
    $("editCategory").value = item.category || "Other";
    $("editDate").value = item.date;
    $("editNotes").value = item.notes || "";
    $("editDialog").showModal();
  }
});

$("editForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const itemName = $("editName").value.trim();
  const price = Number($("editPrice").value);
  const quantity = Number($("editQuantity").value);
  const date = $("editDate").value;
  if (
    !itemName ||
    $("editPrice").value === "" ||
    !Number.isFinite(price) ||
    price < 0 ||
    !Number.isFinite(quantity) ||
    quantity <= 0 ||
    !date
  ) {
    showToast("Please enter valid expense details.");
    return;
  }
  expenses = expenses.map((e) =>
    e.id === editingId
      ? {
          ...e,
          itemName,
          price,
          quantity,
          date,
          category: $("editCategory").value || "Other",
          notes: $("editNotes").value.trim(),
        }
      : e,
  );
  if (saveExpenses()) {
    $("editDialog").close();
    render();
    showToast("Expense updated.");
  }
});
$("cancelEdit").addEventListener("click", () => $("editDialog").close());

["search", "startDate", "endDate"].forEach((id) =>
  $(id).addEventListener("input", render),
);
$("clearFilters").addEventListener("click", () => {
  $("search").value = "";
  $("startDate").value = "";
  $("endDate").value = "";
  render();
});

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
$("exportBtn").addEventListener("click", () => {
  downloadFile(
    `expense-backup-${localDateString()}.json`,
    JSON.stringify(expenses, null, 2),
    "application/json",
  );
  showToast("Backup exported.");
});
$("importFile").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const imported = JSON.parse(await file.text());
    if (!Array.isArray(imported) || !imported.every(isValidExpense))
      throw new Error("invalid");
    if (
      !confirm(
        `Import ${imported.length} records? This replaces the current expense list.`,
      )
    )
      return;
    expenses = imported.map((item) => ({
      id: item.id,
      itemName: item.itemName,
      price: Number(item.price),
      quantity: Number(item.quantity),
      category: item.category || "Other",
      date: item.date,
      notes: item.notes || "",
      createdAt: Number(item.createdAt) || Date.now(),
    }));
    if (saveExpenses()) {
      render();
      showToast("Backup imported.");
    }
  } catch {
    showToast("That backup file is invalid.");
  } finally {
    event.target.value = "";
  }
});
$("csvBtn").addEventListener("click", () => {
  const rows = [
    ["Date", "Item", "Category", "Price", "Quantity", "Total", "Notes"],
  ];
  expenses
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach((e) => {
      rows.push([
        e.date,
        e.itemName,
        e.category || "Other",
        e.price,
        e.quantity,
        Number(e.price) * Number(e.quantity),
        e.notes || "",
      ]);
    });
  const csv = rows
    .map((row) =>
      row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","),
    )
    .join("\r\n");
  downloadFile(
    `expenses-${localDateString()}.csv`,
    "\uFEFF" + csv,
    "text/csv;charset=utf-8",
  );
  showToast("CSV downloaded.");
});

render();

document.querySelector(".show-btn").addEventListener("click", function () {
  const historyPanel = document.getElementById("expenseRows").closest(".panel");

  historyPanel.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
});
const showBtn = document.querySelector(".show-btn");
const historySection = document.getElementById("historySection");

showBtn.addEventListener("click", function () {
  historySection.hidden = !historySection.hidden;

  if (!historySection.hidden) {
    historySection.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

    showBtn.textContent = "Hide History";
  } else {
    showBtn.textContent = "Show History";
  }
});