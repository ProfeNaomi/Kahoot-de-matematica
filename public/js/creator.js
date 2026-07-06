// creator.js - Lógica del Creador y Gestor de Cuestionarios

let allQuizzes = [];
let currentQuestions = [];

const listSection = document.getElementById('listSection');
const editorSection = document.getElementById('editorSection');
const quizListGrid = document.getElementById('quizListGrid');
const questionsContainer = document.getElementById('questionsContainer');
const quizForm = document.getElementById('quizForm');

// 1. Cargar cuestionarios al iniciar
document.addEventListener('DOMContentLoaded', () => {
  loadAllQuizzes();

  // Escuchar importación de archivos JSON
  document.getElementById('importFileInput').addEventListener('change', handleImportJSON);
});

function loadAllQuizzes() {
  fetch('/api/quizzes')
    .then(res => res.json())
    .then(data => {
      allQuizzes = data;
      renderQuizList();
    })
    .catch(err => {
      quizListGrid.innerHTML = `<p style="color: #ff4d6d; grid-column: 1/-1;">Error al cargar datos del servidor Node.js.</p>`;
    });
}

// 2. Renderizar lista de cuestionarios en tarjetas
function renderQuizList() {
  if (allQuizzes.length === 0) {
    quizListGrid.innerHTML = `<p style="color: var(--text-muted); grid-column: 1/-1;">No hay cuestionarios. Haz clic en "➕ Nuevo Cuestionario" para crear el primero.</p>`;
    return;
  }

  quizListGrid.innerHTML = allQuizzes.map(q => `
    <div class="glass-panel glass-panel-hover" style="padding: 24px; display: flex; flex-direction: column; justify-content: space-between;">
      <div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <span style="background: rgba(112, 0, 255, 0.2); color: #a5b4fc; padding: 4px 12px; border-radius: 6px; font-weight: 700; font-size: 0.85rem;">
            📂 ${q.category || 'Aritmética'}
          </span>
          <span style="font-weight: 700; color: var(--color-gold);">❓ ${q.questions.length} Preguntas</span>
        </div>
        <h3 style="font-size: 1.6rem; margin-bottom: 8px;">${q.title}</h3>
        <p style="color: var(--text-muted); font-size: 0.95rem; line-height: 1.5; margin-bottom: 20px;">
          ${q.description || 'Sin descripción'}
        </p>
      </div>

      <div style="display: flex; gap: 8px; flex-wrap: wrap; border-top: 1px solid var(--border-color); padding-top: 16px;">
        <a href="host.html" class="btn btn-primary" style="flex: 1; padding: 10px; font-size: 0.95rem;">
          🎮 Proyectar
        </a>
        <button onclick="editQuiz('${q.id}')" class="btn btn-outline" style="padding: 10px 14px;" title="Editar">
          ✏️
        </button>
        <button onclick="exportQuizJSON('${q.id}')" class="btn btn-outline" style="padding: 10px 14px; color: var(--color-green); border-color: var(--color-green);" title="Exportar JSON para otra plataforma">
          📥 JSON
        </button>
      </div>
    </div>
  `).join('');
}

// 3. Mostrar editor para crear un nuevo cuestionario
function showNewQuizForm() {
  document.getElementById('quizId').value = `math-custom-${Date.now()}`;
  document.getElementById('quizTitle').value = '';
  document.getElementById('quizCategory').value = 'Matemática';
  document.getElementById('quizDesc').value = '';
  document.getElementById('editorTitle').textContent = '✨ Crear Nuevo Cuestionario';

  currentQuestions = [
    { question: "¿Cuánto es 5 × 5 + 10?", options: ["25", "35", "40", "30"], correctOption: 1, timeLimit: 15 }
  ];
  renderQuestionsEditor();

  listSection.classList.add('hidden');
  editorSection.classList.remove('hidden');
}

// 4. Mostrar editor para editar un cuestionario existente
function editQuiz(id) {
  const quiz = allQuizzes.find(q => q.id === id);
  if (!quiz) return;

  document.getElementById('quizId').value = quiz.id;
  document.getElementById('quizTitle').value = quiz.title;
  document.getElementById('quizCategory').value = quiz.category || 'Matemática';
  document.getElementById('quizDesc').value = quiz.description || '';
  document.getElementById('editorTitle').textContent = `✏️ Editar: ${quiz.title}`;

  currentQuestions = JSON.parse(JSON.stringify(quiz.questions));
  renderQuestionsEditor();

  listSection.classList.add('hidden');
  editorSection.classList.remove('hidden');
}

function hideEditor() {
  editorSection.classList.add('hidden');
  listSection.classList.remove('hidden');
}

// 5. Renderizar y manejar tarjetas de preguntas
function renderQuestionsEditor() {
  questionsContainer.innerHTML = currentQuestions.map((q, idx) => `
    <div class="question-card" id="q-card-${idx}">
      <div class="question-header">
        <span style="font-weight: 800; font-size: 1.2rem; color: #a5b4fc;">Pregunta #${idx + 1}</span>
        <div style="display: flex; gap: 12px; align-items: center;">
          <label style="font-size: 0.85rem; font-weight: 700;">⏱️ Tiempo:</label>
          <select class="input-field" style="width: auto; padding: 6px 12px;" onchange="updateQuestionField(${idx}, 'timeLimit', parseInt(this.value))">
            <option value="10" ${q.timeLimit === 10 ? 'selected' : ''}>10 seg</option>
            <option value="15" ${q.timeLimit === 15 ? 'selected' : ''}>15 seg</option>
            <option value="20" ${q.timeLimit === 20 ? 'selected' : ''}>20 seg</option>
            <option value="30" ${q.timeLimit === 30 ? 'selected' : ''}>30 seg</option>
            <option value="60" ${q.timeLimit === 60 ? 'selected' : ''}>60 seg</option>
          </select>
          ${currentQuestions.length > 1 ? `
            <button type="button" onclick="deleteQuestion(${idx})" class="btn btn-danger" style="padding: 6px 12px; font-size: 0.9rem;">
              🗑️
            </button>
          ` : ''}
        </div>
      </div>

      <div>
        <label style="font-weight: 700; font-size: 0.85rem; color: var(--text-muted);">ENUNCIADO O ECUACIÓN</label>
        <input type="text" class="input-field" value="${q.question}" placeholder="Ej: ¿Cuál es la raíz cuadrada de 144?" onchange="updateQuestionField(${idx}, 'question', this.value)" required>
      </div>

      <div class="options-edit-grid">
        ${[0, 1, 2, 3].map(optIdx => {
          const shapes = ['▲ Rojo', '◆ Azul', '● Amarillo', '■ Verde'];
          return `
            <div class="option-input-box opt-box-${optIdx}">
              <input type="radio" name="correct-${idx}" value="${optIdx}" ${q.correctOption === optIdx ? 'checked' : ''} onchange="updateQuestionField(${idx}, 'correctOption', ${optIdx})" title="Marcar como respuesta correcta" style="width: 24px; height: 24px; cursor: pointer;">
              <div style="flex: 1;">
                <span style="font-size: 0.75rem; font-weight: 800; display: block; margin-bottom: 4px;">${shapes[optIdx]}</span>
                <input type="text" class="input-field" style="padding: 8px 12px; font-size: 1rem;" value="${q.options[optIdx] || ''}" placeholder="Opción ${optIdx + 1}" onchange="updateOptionText(${idx}, ${optIdx}, this.value)" required>
              </div>
            </div>
          `;
        }).join('')}
      </div>
      <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 10px; text-align: right;">
        💡 Selecciona el botón de radio circular junto al color que represente la respuesta correcta.
      </p>
    </div>
  `).join('');
}

function updateQuestionField(qIdx, field, value) {
  currentQuestions[qIdx][field] = value;
}

function updateOptionText(qIdx, optIdx, text) {
  currentQuestions[qIdx].options[optIdx] = text;
}

function addQuestionCard() {
  currentQuestions.push({
    question: "",
    options: ["", "", "", ""],
    correctOption: 0,
    timeLimit: 15
  });
  renderQuestionsEditor();
  soundFX.playTone(600, 'sine', 0.1, 0.1);
}

function deleteQuestion(qIdx) {
  if (currentQuestions.length <= 1) return;
  currentQuestions.splice(qIdx, 1);
  renderQuestionsEditor();
  soundFX.playWrong();
}

// 6. Guardar cuestionario en el servidor
quizForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const newQuiz = {
    id: document.getElementById('quizId').value,
    title: document.getElementById('quizTitle').value.trim(),
    category: document.getElementById('quizCategory').value.trim(),
    description: document.getElementById('quizDesc').value.trim(),
    timeLimit: 15,
    questions: currentQuestions
  };

  fetch('/api/quizzes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newQuiz)
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      soundFX.playCorrect();
      alert('✅ ¡Cuestionario guardado con éxito!');
      hideEditor();
      loadAllQuizzes();
    } else {
      alert('❌ Error al guardar: ' + (data.error || 'Desconocido'));
    }
  })
  .catch(err => {
    alert('❌ Error de conexión con el servidor Node.js');
  });
});

// 7. Exportar cuestionario individual a archivo JSON (Para integrar en la casa)
function exportQuizJSON(id) {
  const quiz = allQuizzes.find(q => q.id === id);
  if (!quiz) return;

  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(quiz, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `kahoot-matematica-${quiz.id}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  soundFX.playStart();
}

// 8. Importar cuestionario desde archivo JSON
function handleImportJSON(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(event) {
    try {
      const importedQuiz = JSON.parse(event.target.result);
      if (!importedQuiz.title || !importedQuiz.questions || !Array.isArray(importedQuiz.questions)) {
        throw new Error("Formato JSON inválido para K-Math");
      }

      // Asignar nuevo ID para evitar colisiones
      importedQuiz.id = `math-import-${Date.now()}`;

      // Enviar al servidor
      fetch('/api/quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(importedQuiz)
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          soundFX.playCorrect();
          alert(`✅ Cuestionario "${importedQuiz.title}" importado con éxito.`);
          loadAllQuizzes();
        }
      });
    } catch (err) {
      alert('❌ El archivo JSON no es válido o está dañado: ' + err.message);
    }
  };
  reader.readAsText(file);
}
