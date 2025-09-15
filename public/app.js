// 자동 크롤링 앱
const API_URL = 'http://localhost:3000/api';

// 전역 변수
let currentSearch = '';
let tempPlaces = [];
let allPlaces = [];
let isAutoMode = true;

// DOM 요소
document.addEventListener('DOMContentLoaded', () => {
  // 요소 가져오기
  const autoSearchInput = document.getElementById('autoSearch');
  const autoSearchBtn = document.getElementById('autoSearchBtn');
  const manualSearchBtn = document.getElementById('manualSearchBtn');
  const autoModeCheckbox = document.getElementById('autoMode');
  const searchStatus = document.getElementById('searchStatus');
  const currentSearchTerm = document.getElementById('currentSearchTerm');
  const quickNameInput = document.getElementById('quickName');
  const quickPhoneInput = document.getElementById('quickPhone');
  const quickAddBtn = document.getElementById('quickAddBtn');
  const quickList = document.getElementById('quickList');
  const savedPlaces = document.getElementById('savedPlaces');
  const filterInput = document.getElementById('filterInput');
  const exportBtn = document.getElementById('exportBtn');
  const clearBtn = document.getElementById('clearBtn');

  // 초기 로드
  loadAllPlaces();

  // 이벤트 리스너
  autoSearchBtn.addEventListener('click', autoSearch);
  manualSearchBtn.addEventListener('click', manualSearch);
  autoModeCheckbox.addEventListener('change', (e) => {
    isAutoMode = e.target.checked;
  });

  autoSearchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      if (isAutoMode) {
        autoSearch();
      } else {
        manualSearch();
      }
    }
  });

  quickAddBtn.addEventListener('click', quickAdd);
  quickNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      if (quickNameInput.value.trim()) {
        quickPhoneInput.focus();
      }
    }
  });

  quickPhoneInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') quickAdd();
  });

  filterInput.addEventListener('input', filterPlaces);
  exportBtn.addEventListener('click', exportToExcel);
  clearBtn.addEventListener('click', clearAll);

  // 자동 검색
  async function autoSearch() {
    const searchTerm = autoSearchInput.value.trim();
    if (!searchTerm) {
      showToast('검색어를 입력하세요');
      return;
    }

    currentSearch = searchTerm;
    currentSearchTerm.textContent = searchTerm;

    // 상태 표시
    showStatus('loading', `🔍 "${searchTerm}" 자동 수집 중... (정확한 데이터를 위해 최대 60초 소요)`);

    try {
      const response = await fetch(`${API_URL}/crawl`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchTerm })
      });

      const data = await response.json();

      if (response.ok) {
        if (data.places && data.places.length > 0) {
          showStatus('success', `✅ ${data.places.length}개 장소 자동 수집 완료!`);
          loadAllPlaces();

          // 3초 후 상태 숨기기
          setTimeout(() => {
            searchStatus.className = 'search-status';
          }, 3000);
        } else {
          showStatus('error', '❌ 검색 결과가 없습니다. 다른 검색어를 시도해보세요.');
        }
      } else {
        showStatus('error', `❌ 오류: ${data.error}`);
      }
    } catch (error) {
      console.error('자동 검색 실패:', error);
      showStatus('error', '❌ 서버 연결 실패. 서버가 실행 중인지 확인하세요.');
    }
  }

  // 수동 검색
  function manualSearch() {
    const searchTerm = autoSearchInput.value.trim();
    if (!searchTerm) {
      showToast('검색어를 입력하세요');
      return;
    }

    currentSearch = searchTerm;
    currentSearchTerm.textContent = searchTerm;
    tempPlaces = [];
    renderTempList();

    // 네이버 지도 새 창 열기
    const naverUrl = `https://map.naver.com/p/search/${encodeURIComponent(searchTerm)}`;
    window.open(naverUrl, '_blank');

    // 입력 필드로 포커스
    quickNameInput.focus();
    showToast(`"${searchTerm}" 수동 입력 모드 시작`);
  }

  // 상태 표시
  function showStatus(type, message) {
    searchStatus.className = `search-status ${type}`;
    searchStatus.textContent = message;
  }

  // 빠른 추가
  async function quickAdd() {
    const name = quickNameInput.value.trim();
    const phone = quickPhoneInput.value.trim();

    if (!name) {
      showToast('장소명을 입력하세요');
      quickNameInput.focus();
      return;
    }

    if (!currentSearch) {
      showToast('먼저 검색어를 입력하세요');
      autoSearchInput.focus();
      return;
    }

    // 임시 목록에 추가
    const tempPlace = {
      name,
      phone,
      search: currentSearch,
      timestamp: new Date().toISOString()
    };

    tempPlaces.push(tempPlace);

    // DB에 저장
    try {
      // 먼저 검색 추가
      const searchResponse = await fetch(`${API_URL}/searches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: currentSearch,
          category: '수동'
        })
      });
      const searchData = await searchResponse.json();

      // 장소 추가
      await fetch(`${API_URL}/places`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          search_id: searchData.id,
          name,
          phone,
          address: '',
          category: '음식점',
          rating: null,
          url: '',
          notes: '수동 입력'
        })
      });

      // 입력 필드 초기화
      quickNameInput.value = '';
      quickPhoneInput.value = '';
      quickNameInput.focus();

      renderTempList();
      loadAllPlaces();
      showToast(`"${name}" 추가됨`);

    } catch (error) {
      console.error('저장 실패:', error);
      showToast('저장 실패');
    }
  }

  // 임시 목록 렌더링
  function renderTempList() {
    if (tempPlaces.length === 0) {
      quickList.innerHTML = '<div style="color: #999; text-align: center; padding: 20px;">추가된 장소가 없습니다</div>';
      return;
    }

    quickList.innerHTML = tempPlaces.map((place, index) => `
      <div class="quick-item">
        <div class="quick-item-info">
          <span class="quick-item-name">${place.name}</span>
          <span class="quick-item-phone">${place.phone || '-'}</span>
        </div>
        <button onclick="removeTempPlace(${index})">삭제</button>
      </div>
    `).join('');
  }

  // 모든 장소 로드
  async function loadAllPlaces() {
    try {
      const response = await fetch(`${API_URL}/places`);
      allPlaces = await response.json();
      renderSavedPlaces();
    } catch (error) {
      console.error('로드 실패:', error);
      allPlaces = [];
      renderSavedPlaces();
    }
  }

  // 저장된 장소 렌더링
  function renderSavedPlaces() {
    const filterText = filterInput.value.toLowerCase();
    const filtered = allPlaces.filter(place => {
      const searchText = `${place.name} ${place.phone || ''} ${place.address || ''} ${place.notes || ''}`.toLowerCase();
      return searchText.includes(filterText);
    });

    if (filtered.length === 0) {
      savedPlaces.innerHTML = '<div style="color: #999; text-align: center; padding: 40px;">저장된 장소가 없습니다</div>';
      return;
    }

    savedPlaces.innerHTML = filtered.map(place => {
      const isAuto = place.notes && place.notes.includes('자동');
      const badgeColor = isAuto ? '#667eea' : '#6c757d';
      const badgeText = isAuto ? '자동' : '수동';

      return `
        <div class="place-item">
          <div class="place-info" onclick="openNaverPlace('${place.name}', '${place.address || ''}')" style="cursor: pointer;">
            <div class="place-main-row">
              <span class="place-search" style="background: ${badgeColor}; color: white;">${badgeText}</span>
              <span class="place-name">${place.name}</span>
              <span class="place-phone">${place.phone || '-'}</span>
              ${place.address ? `<span class="place-address" style="color: #999; font-size: 12px;">${place.address}</span>` : ''}
              <span class="place-date">${new Date(place.created_at).toLocaleDateString('ko-KR')}</span>
            </div>
            <span class="place-click-hint" style="color: #007bff; font-size: 11px; margin-top: 4px;">📍 클릭하여 네이버 지도에서 확인</span>
          </div>
          <div class="place-actions">
            <button class="delete-btn" onclick="event.stopPropagation(); deletePlace(${place.id})">삭제</button>
          </div>
        </div>
      `;
    }).join('');
  }

  // 필터링
  function filterPlaces() {
    renderSavedPlaces();
  }

  // Excel 내보내기
  function exportToExcel() {
    if (allPlaces.length === 0) {
      showToast('내보낼 데이터가 없습니다');
      return;
    }

    // CSV 형식으로 변환
    const headers = ['수집방식', '장소명', '전화번호', '주소', '메모', '날짜'];
    const rows = allPlaces.map(place => {
      const isAuto = place.notes && place.notes.includes('자동');
      return [
        isAuto ? '자동' : '수동',
        place.name,
        place.phone || '',
        place.address || '',
        place.notes || '',
        new Date(place.created_at).toLocaleDateString('ko-KR')
      ];
    });

    let csv = '\uFEFF'; // UTF-8 BOM
    csv += headers.join(',') + '\n';
    csv += rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    // 다운로드
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `naver_places_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('Excel 파일 다운로드 시작');
  }

  // 전체 초기화
  async function clearAll() {
    if (!confirm('모든 데이터를 삭제하시겠습니까?')) return;

    try {
      // 모든 장소 삭제
      for (const place of allPlaces) {
        await fetch(`${API_URL}/places/${place.id}`, { method: 'DELETE' });
      }

      allPlaces = [];
      tempPlaces = [];
      currentSearch = '';
      currentSearchTerm.textContent = '-';
      renderTempList();
      renderSavedPlaces();
      showToast('모든 데이터가 삭제되었습니다');
    } catch (error) {
      showToast('삭제 실패');
    }
  }

  // 글로벌 함수들
  window.removeTempPlace = function(index) {
    tempPlaces.splice(index, 1);
    renderTempList();
  };

  window.deletePlace = async function(placeId) {
    try {
      await fetch(`${API_URL}/places/${placeId}`, { method: 'DELETE' });
      loadAllPlaces();
      showToast('삭제되었습니다');
    } catch (error) {
      showToast('삭제 실패');
    }
  };

  // 네이버 플레이스 열기
  window.openNaverPlace = function(placeName, placeAddress) {
    // 검색 쿼리 구성: 장소명과 주소를 조합
    let searchQuery = placeName;
    if (placeAddress && placeAddress !== '') {
      searchQuery = `${placeName} ${placeAddress}`;
    }

    // 네이버 지도 URL 생성
    const naverMapUrl = `https://map.naver.com/p/search/${encodeURIComponent(searchQuery)}`;

    // 새 탭에서 네이버 지도 열기
    window.open(naverMapUrl, '_blank');

    // 사용자에게 피드백
    showToast(`"${placeName}" 네이버 지도에서 확인 중...`);
  };
});

// 토스트 메시지
function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}