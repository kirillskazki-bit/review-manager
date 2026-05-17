import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [reviews, setReviews] = useState([]);
  const [settings, setSettings] = useState({
    ozonClientId: localStorage.getItem('ozonClientId') || '',
    ozonApiKey: localStorage.getItem('ozonApiKey') || '',
    groqApiKey: localStorage.getItem('groqApiKey') || '',
    responseTone: localStorage.getItem('responseTone') || 'friendly',
    autoPublishMinRating: parseInt(localStorage.getItem('autoPublishMinRating') || '4'),
  });
  const [showSettings, setShowSettings] = useState(!settings.ozonClientId);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ total: 0, published: 0, pending: 0, avgRating: 0 });
  const [selectedReview, setSelectedReview] = useState(null);
  const [aiResponse, setAiResponse] = useState('');
  const [editingResponse, setEditingResponse] = useState('');

  // Демо отзывы для тестирования
  const demoReviews = [
    {
      id: 'demo_1',
      rating: 5,
      text: 'Супер машинка! Сыну очень понравилась, хорошее качество, рекомендую!',
      author: 'Иван П.',
      productName: 'Машинка на пульте управления',
      createdAt: new Date().toLocaleDateString('ru-RU')
    },
    {
      id: 'demo_2',
      rating: 4,
      text: 'Хороший самокат, быстро доставили. Только чуть меньше размером чем ожидал.',
      author: 'Мария К.',
      productName: 'Самокат детский',
      createdAt: new Date().toLocaleDateString('ru-RU')
    },
    {
      id: 'demo_3',
      rating: 3,
      text: 'Игрушка нормальная, но колесо скрипит. Может быть неправильно собрал?',
      author: 'Петр М.',
      productName: 'Экскаватор на пульте',
      createdAt: new Date().toLocaleDateString('ru-RU')
    },
    {
      id: 'demo_4',
      rating: 2,
      text: 'Батарейки быстро сели, не очень доволен',
      author: 'Алекс Р.',
      productName: 'Машинка на пульте управления',
      createdAt: new Date().toLocaleDateString('ru-RU')
    },
    {
      id: 'demo_5',
      rating: 5,
      text: 'Отличный самокат! Сыну 8 лет, катается каждый день. Очень доволен покупкой!',
      author: 'Анна Л.',
      productName: 'Самокат детский',
      createdAt: new Date().toLocaleDateString('ru-RU')
    }
  ];

  // Загрузить отзывы из Ozon
  const loadReviews = async () => {
    setLoading(true);
    try {
      // Если ключи не заполнены - загрузи демо
      if (!settings.ozonClientId || !settings.ozonApiKey) {
        console.log('API ключи не заполнены, загружаю ДЕМО отзывы...');
        const enrichedReviews = demoReviews.map(r => ({
          ...r,
          status: localStorage.getItem(`review_${r.id}_status`) || 'new',
          aiResponse: localStorage.getItem(`review_${r.id}_response`) || ''
        }));
        setReviews(enrichedReviews);
        updateStats(enrichedReviews);
        alert('📭 Загружены ДЕМО отзывы. Заполни API ключи в настройках для реальных отзывов.');
        return;
      }

      // CORS прокси для обхода ограничений
      const corsProxy = 'https://cors-anywhere.herokuapp.com/';
      const ozonUrl = 'https://api-seller.ozon.ru/v2/review/list';

      const response = await axios.post(corsProxy + ozonUrl,
        { page: 1, page_size: 10 },
        {
          headers: {
            'Client-Id': settings.ozonClientId,
            'Api-Key': settings.ozonApiKey,
            'Content-Type': 'application/json'
          }
        }
      );

      const ozonReviews = response.data.reviews || [];
      const enrichedReviews = ozonReviews.map((r, idx) => ({
        id: r.id || idx,
        rating: r.rating || 0,
        text: r.text || 'Без текста',
        author: r.author_name || 'Аноним',
        productName: r.product_name || 'Товар',
        status: localStorage.getItem(`review_${r.id}_status`) || 'new',
        aiResponse: localStorage.getItem(`review_${r.id}_response`) || '',
        createdAt: new Date().toLocaleDateString('ru-RU')
      }));

      setReviews(enrichedReviews);
      updateStats(enrichedReviews);
    } catch (error) {
      console.error('Ошибка загрузки отзывов:', error.message);
      // Если реальные отзывы не загрузились - показываем демо
      const enrichedReviews = demoReviews.map(r => ({
        ...r,
        status: localStorage.getItem(`review_${r.id}_status`) || 'new',
        aiResponse: localStorage.getItem(`review_${r.id}_response`) || ''
      }));
      setReviews(enrichedReviews);
      updateStats(enrichedReviews);
      alert('⚠️ Не удалось загрузить реальные отзывы. Показываю ДЕМО отзывы для тестирования.');
    }
    setLoading(false);
  };

  // Обновить статистику
  const updateStats = (reviewsList) => {
    const total = reviewsList.length;
    const published = reviewsList.filter(r => r.status === 'published').length;
    const pending = reviewsList.filter(r => r.status === 'new' || r.status === 'waiting').length;
    const avgRating = total > 0 ? (reviewsList.reduce((sum, r) => sum + r.rating, 0) / total).toFixed(1) : 0;

    setStats({ total, published, pending, avgRating });
  };

  // Сгенерировать ответ через Groq
  const generateAiResponse = async (review) => {
    if (!settings.groqApiKey) {
      alert('⚠️ Заполни Groq API ключ в настройках!');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post('https://api.groq.com/openai/v1/chat/completions',
        {
          model: 'mixtral-8x7b-32768',
          max_tokens: 300,
          messages: [
            {
              role: 'user',
              content: `Ты менеджер по продажам детских игрушек и самокатов.

Напиши дружелюбный и краткий ответ на отзыв (50-150 слов).
Тон: ${settings.responseTone} (дружелюбный и личный)

Информация об отзыве:
- Товар: ${review.productName}
- Рейтинг: ${review.rating}/5 звезд
- Текст отзыва: ${review.text}

Требования:
1. Начни с благодарности за отзыв
2. Обращайся по имени если есть
3. Если рейтинг низкий (1-3), предложи помощь
4. Используй эмодзи для эмоциональности
5. Закончи предложением улучшить опыт

Напиши только ответ, без предисловий.`
            }
          ]
        },
        {
          headers: {
            'Authorization': `Bearer ${settings.groqApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const generatedText = response.data.choices[0].message.content;
      setAiResponse(generatedText);
      setEditingResponse(generatedText);
      setSelectedReview(review);
    } catch (error) {
      console.error('Ошибка генерации ответа:', error.message);
      alert('❌ Ошибка генерации ответа. Проверь Groq API ключ.');
    }
    setLoading(false);
  };

  // Опубликовать ответ
  const publishResponse = async (review, responseText) => {
    if (!settings.ozonClientId || !settings.ozonApiKey) {
      alert('⚠️ Проверь API ключи Ozon!');
      return;
    }

    setLoading(true);
    try {
      await axios.post('https://api-seller.ozon.ru/v2/review/answer',
        {
          review_id: review.id,
          text: responseText
        },
        {
          headers: {
            'Client-Id': settings.ozonClientId,
            'Api-Key': settings.ozonApiKey,
            'Content-Type': 'application/json'
          }
        }
      );

      // Сохрани в локальное хранилище
      localStorage.setItem(`review_${review.id}_status`, 'published');
      localStorage.setItem(`review_${review.id}_response`, responseText);

      // Обнови список
      const updated = reviews.map(r =>
        r.id === review.id
          ? { ...r, status: 'published', aiResponse: responseText }
          : r
      );
      setReviews(updated);
      updateStats(updated);

      alert('✅ Ответ опубликован в Ozon!');
      setSelectedReview(null);
      setAiResponse('');
    } catch (error) {
      console.error('Ошибка публикации:', error.message);
      alert('❌ Ошибка публикации. Проверь данные.');
    }
    setLoading(false);
  };

  // Сохранить настройки
  const saveSettings = () => {
    localStorage.setItem('ozonClientId', settings.ozonClientId);
    localStorage.setItem('ozonApiKey', settings.ozonApiKey);
    localStorage.setItem('groqApiKey', settings.groqApiKey);
    localStorage.setItem('responseTone', settings.responseTone);
    localStorage.setItem('autoPublishMinRating', settings.autoPublishMinRating);
    alert('✅ Настройки сохранены!');
    setShowSettings(false);
  };

  return (
    <div className="app">
      <header className="header">
        <h1>🤖 Управление отзывами</h1>
        <button onClick={() => setShowSettings(!showSettings)} className="btn-settings">
          ⚙️ Настройки
        </button>
      </header>

      {showSettings ? (
        <div className="settings-panel">
          <h2>⚙️ Настройки</h2>

          <div className="setting-group">
            <label>Ozon Client ID:</label>
            <input
              type="text"
              value={settings.ozonClientId}
              onChange={(e) => setSettings({...settings, ozonClientId: e.target.value})}
              placeholder="1922743"
            />
          </div>

          <div className="setting-group">
            <label>Ozon API Key:</label>
            <input
              type="password"
              value={settings.ozonApiKey}
              onChange={(e) => setSettings({...settings, ozonApiKey: e.target.value})}
              placeholder="твой API ключ Ozon"
            />
          </div>

          <div className="setting-group">
            <label>Groq API Key:</label>
            <input
              type="password"
              value={settings.groqApiKey}
              onChange={(e) => setSettings({...settings, groqApiKey: e.target.value})}
              placeholder="gsk_..."
            />
          </div>

          <div className="setting-group">
            <label>Тон ответов:</label>
            <select
              value={settings.responseTone}
              onChange={(e) => setSettings({...settings, responseTone: e.target.value})}
            >
              <option value="friendly">Дружелюбный 😊</option>
              <option value="professional">Профессиональный 💼</option>
              <option value="casual">Casual 😎</option>
            </select>
          </div>

          <div className="setting-group">
            <label>Автопубликация при рейтинге:</label>
            <select
              value={settings.autoPublishMinRating}
              onChange={(e) => setSettings({...settings, autoPublishMinRating: parseInt(e.target.value)})}
            >
              <option value="4">4+ звезд</option>
              <option value="3">3+ звезд</option>
              <option value="5">Только 5 звезд</option>
            </select>
          </div>

          <button onClick={saveSettings} className="btn btn-primary">
            ✅ Сохранить настройки
          </button>
        </div>
      ) : (
        <>
          <div className="stats-panel">
            <div className="stat">
              <span className="stat-label">Всего отзывов</span>
              <span className="stat-value">{stats.total}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Опубликовано</span>
              <span className="stat-value">{stats.published}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Ожидают</span>
              <span className="stat-value">{stats.pending}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Средний рейтинг</span>
              <span className="stat-value">{stats.avgRating}⭐</span>
            </div>
          </div>

          <button
            onClick={loadReviews}
            className="btn btn-primary btn-large"
            disabled={loading}
          >
            {loading ? '⏳ Загружаю...' : '📥 Загрузить отзывы из Ozon'}
          </button>

          {selectedReview ? (
            <div className="modal">
              <div className="modal-content">
                <h2>✏️ Редактирование ответа</h2>
                <div className="review-detail">
                  <p><strong>Отзыв:</strong> {selectedReview.text}</p>
                  <p><strong>Рейтинг:</strong> {'⭐'.repeat(selectedReview.rating)}</p>
                </div>

                <textarea
                  value={editingResponse}
                  onChange={(e) => setEditingResponse(e.target.value)}
                  placeholder="Отредактируй ответ ИИ..."
                  rows="6"
                  className="response-textarea"
                />

                <div className="modal-buttons">
                  <button
                    onClick={() => publishResponse(selectedReview, editingResponse)}
                    className="btn btn-primary"
                    disabled={loading}
                  >
                    {loading ? '📤 Публикую...' : '✅ Опубликовать'}
                  </button>
                  <button
                    onClick={() => {
                      setSelectedReview(null);
                      setAiResponse('');
                    }}
                    className="btn btn-secondary"
                  >
                    ❌ Отмена
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="reviews-list">
            {reviews.length === 0 ? (
              <p className="empty-state">📭 Отзывы не загружены. Нажми кнопку выше.</p>
            ) : (
              reviews.map(review => (
                <div key={review.id} className={`review-card status-${review.status}`}>
                  <div className="review-header">
                    <span className="review-rating">{'⭐'.repeat(review.rating)}</span>
                    <span className="review-author">{review.author}</span>
                    <span className={`review-status status-${review.status}`}>
                      {review.status === 'published' ? '✅ Опубликовано' : '⏳ Ожидает'}
                    </span>
                  </div>

                  <p className="review-text">"{review.text}"</p>
                  <p className="review-product">📦 {review.productName}</p>

                  {review.status === 'published' ? (
                    <div className="response-box">
                      <p><strong>Мой ответ:</strong></p>
                      <p>{review.aiResponse}</p>
                    </div>
                  ) : (
                    <button
                      onClick={() => generateAiResponse(review)}
                      className="btn btn-generate"
                      disabled={loading}
                    >
                      {loading ? '⏳ Генерирую...' : '🤖 Сгенерировать ответ'}
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default App;
