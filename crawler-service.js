import puppeteer from 'puppeteer';

class NaverMapCrawler {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async init() {
    console.log('🚀 진짜 네이버 지도 크롤러 초기화...');

    this.browser = await puppeteer.launch({
      headless: false, // 브라우저를 보면서 디버깅
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
      ]
    });

    this.page = await this.browser.newPage();

    // 네이버 봇 감지 우회
    await this.page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });
      window.chrome = { runtime: {} };
    });

    await this.page.setViewport({ width: 1366, height: 768 });
  }

  async searchPlaces(query) {
    try {
      console.log(`🔍 실제 네이버 지도 검색: "${query}"`);

      // 한글 인코딩 확인
      const encodedQuery = encodeURIComponent(query);
      const searchUrl = `https://map.naver.com/p/search/${encodedQuery}`;
      console.log(`📍 접속 URL: ${searchUrl}`);
      console.log(`📝 인코딩된 검색어: ${encodedQuery}`);

      // 페이지 이동
      await this.page.goto(searchUrl, {
        waitUntil: 'networkidle0',
        timeout: 30000
      });

      console.log('⏳ 검색 결과 로딩 대기 (10초)...');
      await new Promise(resolve => setTimeout(resolve, 10000));

      // 추가 대기: 동적 콘텐츠 완전 로딩까지
      console.log('🔄 동적 콘텐츠 추가 로딩 대기 (5초)...');
      await new Promise(resolve => setTimeout(resolve, 5000));

      // 검색 결과가 실제로 로딩되었는지 확인
      console.log('🔍 검색 결과 로딩 상태 확인...');
      try {
        await this.page.waitForSelector('iframe, .place_item, .search_item', {
          timeout: 10000,
          visible: true
        });
        console.log('✅ 검색 결과 요소 감지됨');
      } catch (e) {
        console.log('⚠️ 검색 결과 요소 감지 실패, 계속 진행...');
      }

      // iframe 찾기
      const frames = this.page.frames();
      console.log(`📄 총 ${frames.length}개 프레임 발견`);

      let searchFrame = null;
      for (const frame of frames) {
        const url = frame.url();
        if (url.includes('search') && url.includes('list')) {
          searchFrame = frame;
          console.log(`✅ 검색 결과 프레임 발견: ${url.substring(0, 100)}...`);
          break;
        }
      }

      let places = [];

      if (searchFrame) {
        console.log('🎯 iframe에서 실제 데이터 추출 시도...');
        places = await this.extractFromSearchFrame(searchFrame);
        console.log(`📊 iframe 추출 결과: ${places.length}개`);
      }

      // 메인 페이지에서도 시도 (더 긴 대기시간)
      if (places.length === 0) {
        console.log('🔄 메인 페이지에서 데이터 추출 시도...');
        console.log('⏳ 메인 페이지 안정화 대기 (3초)...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        places = await this.extractFromMainPage();
        console.log(`📊 메인 페이지 추출 결과: ${places.length}개`);
      }

      // 어떤 방법으로도 추출되지 않으면 페이지 전체 텍스트에서 패턴 매칭
      if (places.length === 0) {
        console.log('🔍 페이지 전체 텍스트에서 패턴 매칭 시도...');
        console.log('⏳ 텍스트 분석 준비 대기 (2초)...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        places = await this.extractFromText();
        console.log(`📊 텍스트 패턴 추출 결과: ${places.length}개`);
      }

      console.log(`✅ 최종 추출 결과: ${places.length}개 플레이스`);

      places.forEach((place, index) => {
        console.log(`${index + 1}. ${place.name}`);
        console.log(`   📞 ${place.phone || '전화번호 없음'}`);
        console.log(`   📍 ${place.address || '주소 없음'}`);
        console.log(`   🏷️ ${place.category || '카테고리 없음'}`);
        console.log('   ---');
      });

      return places;

    } catch (error) {
      console.error('❌ 크롤링 실패:', error.message);
      return [];
    }
  }

  async extractFromSearchFrame(frame) {
    try {
      const places = await frame.evaluate(() => {
        const results = [];
        const debugInfo = [];

        // 먼저 전체 페이지 HTML 조사
        debugInfo.push(`=== 페이지 전체 HTML 조사 ===`);
        const allElements = document.querySelectorAll('*');
        debugInfo.push(`전체 요소 수: ${allElements.length}`);

        // 전화번호가 포함된 텍스트 찾기
        const phoneElements = [];
        allElements.forEach((el, index) => {
          const text = el.textContent || '';
          if (/0507[-\s]?\d{4}[-\s]?\d{4}/.test(text)) {
            phoneElements.push({
              tagName: el.tagName,
              className: el.className,
              text: text.substring(0, 100),
              innerHTML: el.innerHTML.substring(0, 200)
            });
          }
        });

        debugInfo.push(`0507 패턴 찾은 요소 수: ${phoneElements.length}`);
        phoneElements.forEach((el, i) => {
          debugInfo.push(`${i+1}. ${el.tagName}.${el.className}: "${el.text}"`);
        });

        // 네이버 지도 검색 결과 셀렉터들 (2024년 업데이트된 셀렉터)
        const containerSelectors = [
          'ul[role="tablist"]',
          '.CHC5F', // 네이버 지도 리스트 컨테이너
          '.place_section_content',
          '.search_list',
          '.place_list',
          '[role="main"] ul',
          '.search_listitem',
          '.place_item',
          'ul[role="list"]',
          '#_list_scroll_container ul',
          '.list_item'
        ];

        // 모든 가능한 아이템 셀렉터들
        const itemSelectors = [
          '.CHC5F > li',
          '.place_item',
          '.search_item',
          'li[data-index]',
          'li.place_bluelink',
          '.place_section_content li',
          'a.place_bluelink',
          'li'
        ];

        let container = null;
        for (const selector of containerSelectors) {
          container = document.querySelector(selector);
          if (container) {
            debugInfo.push(`✅ 컨테이너 발견: ${selector}`);
            break;
          }
        }

        let items = [];
        if (container) {
          items = container.querySelectorAll('li, .item, .place_bluelink, a');
        } else {
          // 컨테이너를 찾지 못하면 전체 페이지에서 아이템 검색
          for (const selector of itemSelectors) {
            items = document.querySelectorAll(selector);
            if (items.length > 0) {
              debugInfo.push(`✅ 아이템 발견: ${selector}, 개수: ${items.length}`);
              break;
            }
          }
        }

        debugInfo.push(`📝 ${items.length}개 아이템 발견`);

        items.forEach((item, index) => {
          if (index >= 15) return; // 최대 15개

          try {
            const text = item.textContent || '';
            debugInfo.push(`\n=== 아이템 ${index + 1} 디버깅 ===`);
            debugInfo.push(`전체 텍스트: "${text.substring(0, 200)}..."`);
            debugInfo.push(`HTML: ${item.innerHTML.substring(0, 300)}...`);

            // 상호명 추출 - 다양한 방법 (2024년 업데이트)
            let name = '';
            const nameSelectors = [
              '.place_bluelink',
              '.TYaxT',
              '.zPfVt', // 새로운 네이버 지도 셀렉터
              '.CwP5Z', // 장소명 셀렉터
              'strong',
              '.name',
              'h3',
              'a',
              '.place_name',
              '.business_name'
            ];

            for (const sel of nameSelectors) {
              const nameEl = item.querySelector(sel);
              if (nameEl && nameEl.textContent.trim()) {
                name = nameEl.textContent.trim();
                debugInfo.push(`이름 발견 (${sel}): "${name}"`);
                break;
              }
            }

            // 이름이 없으면 첫 번째 줄 사용
            if (!name) {
              const lines = text.split('\n').filter(line => line.trim());
              name = lines[0] ? lines[0].trim() : '';
              debugInfo.push(`첫 번째 줄에서 이름: "${name}"`);
            }

            // 전화번호 추출 - 개선된 정규식 (0507, 070, 1588 등 포함)
            const phonePatterns = [
              /(\d{4}[-\s]?\d{4}[-\s]?\d{4})/, // 0507-1346-3668 형태
              /(\d{3}[-\s]?\d{3,4}[-\s]?\d{4})/, // 070-1234-5678 형태
              /(\d{2,3}[-\s]?\d{3,4}[-\s]?\d{4})/, // 일반 전화번호
            ];

            let phone = '';
            debugInfo.push(`전화번호 텍스트 매칭 시도...`);

            for (const pattern of phonePatterns) {
              const phoneMatch = text.match(pattern);
              if (phoneMatch) {
                phone = phoneMatch[1];
                debugInfo.push(`전화번호 발견 (텍스트): "${phone}"`);
                break;
              }
            }

            // 전화번호 전용 셀렉터에서도 추출 시도
            if (!phone) {
              debugInfo.push(`셀렉터에서 전화번호 찾기 시도...`);
              const phoneSelectors = [
                '.xlx7Q', // 새로운 네이버 지도 전화번호 셀렉터
                '.phone',
                '.tel',
                '.phone_number',
                '[class*="phone"]',
                '[class*="tel"]'
              ];

              for (const sel of phoneSelectors) {
                const phoneEl = item.querySelector(sel);
                if (phoneEl) {
                  debugInfo.push(`${sel} 찾음: "${phoneEl.textContent}"`);
                  const phoneText = phoneEl.textContent.trim();
                  // 전화번호 형태인지 확인
                  if (/\d{2,4}[-\s]?\d{3,4}[-\s]?\d{4}/.test(phoneText)) {
                    phone = phoneText;
                    debugInfo.push(`전화번호 발견 (셀렉터 ${sel}): "${phone}"`);
                    break;
                  }
                } else {
                  debugInfo.push(`${sel} 셀렉터 없음`);
                }
              }
            }

            if (!phone) {
              debugInfo.push(`전화번호 찾지 못함`);
            }

            // 주소 추출
            const addressMatch = text.match(/(경기도|서울|부산|대구|인천|광주|대전|울산|세종|강원|충북|충남|전북|전남|경북|경남|제주).*?[시군구].*?[동면읍로길]/);
            const address = addressMatch ? addressMatch[0] : '';

            // 카테고리 추출
            const categorySelectors = ['.KCMnt', '.category', '.cate'];
            let category = '';
            for (const sel of categorySelectors) {
              const catEl = item.querySelector(sel);
              if (catEl && catEl.textContent.trim()) {
                category = catEl.textContent.trim();
                break;
              }
            }

            // 전화번호가 없으면 더 넓은 범위에서 검색
            if (!phone && name) {
              debugInfo.push(`${name}: 넓은 범위에서 전화번호 검색...`);

              // 전체 페이지에서 이름과 관련된 전화번호 찾기
              const allTextElements = document.querySelectorAll('*');
              for (const el of allTextElements) {
                const elText = el.textContent || '';
                if (elText.includes(name) || elText.includes(name.split(' ')[0])) {
                  // 해당 요소나 주변 요소에서 전화번호 찾기
                  const parentText = (el.parentNode && el.parentNode.textContent) || '';
                  const siblingTexts = Array.from(el.parentNode?.children || [])
                    .map(child => child.textContent).join(' ');

                  const combinedText = elText + ' ' + parentText + ' ' + siblingTexts;

                  for (const pattern of phonePatterns) {
                    const phoneMatch = combinedText.match(pattern);
                    if (phoneMatch) {
                      phone = phoneMatch[1];
                      debugInfo.push(`주변 요소에서 전화번호 발견: ${phone}`);
                      break;
                    }
                  }
                  if (phone) break;
                }
              }
            }

            if (name && name.length > 1 && !name.includes('광고')) {
              results.push({ name, phone, address, category });
            }

          } catch (err) {
            debugInfo.push(`아이템 ${index} 처리 오류: ${err.message}`);
          }
        });

        return { results, debugInfo };
      });

      // 디버그 정보 출력
      console.log('\n=== IFRAME 디버그 정보 ===');
      places.debugInfo.forEach(info => console.log(info));
      console.log('=== IFRAME 디버그 종료 ===\n');

      return places.results;

    } catch (error) {
      console.error('iframe 추출 실패:', error.message);
      return [];
    }
  }

  async extractFromMainPage() {
    try {
      const places = await this.page.evaluate(() => {
        const results = [];

        // 메인 페이지 셀렉터들
        const selectors = [
          '.place_bluelink',
          '.search_item',
          'ul li',
          '[data-id]'
        ];

        let elements = [];
        for (const selector of selectors) {
          elements = Array.from(document.querySelectorAll(selector));
          if (elements.length > 0) {
            console.log(`메인에서 ${elements.length}개 발견: ${selector}`);
            break;
          }
        }

        elements.forEach((element, index) => {
          if (index >= 10) return;

          const text = element.textContent || '';

          // 개선된 전화번호 추출 로직
          const phonePatterns = [
            /(\d{4}[-\s]?\d{4}[-\s]?\d{4})/, // 0507-1346-3668 형태
            /(\d{3}[-\s]?\d{3,4}[-\s]?\d{4})/, // 070-1234-5678 형태
            /(\d{2,3}[-\s]?\d{3,4}[-\s]?\d{4})/, // 일반 전화번호
          ];

          let phoneMatch = null;
          for (const pattern of phonePatterns) {
            phoneMatch = text.match(pattern);
            if (phoneMatch) break;
          }

          if (phoneMatch) {
            const lines = text.split('\n').filter(line => line.trim());
            const name = lines[0] ? lines[0].trim() : '';

            if (name && name.length > 1) {
              results.push({
                name,
                phone: phoneMatch[1],
                address: '',
                category: ''
              });
            }
          }
        });

        return results;
      });

      return places;

    } catch (error) {
      console.error('메인 페이지 추출 실패:', error.message);
      return [];
    }
  }

  async extractFromText() {
    try {
      const places = await this.page.evaluate(() => {
        const results = [];
        const pageText = document.body.textContent;

        // 상호명 + 전화번호 패턴 추출 (개선된 정규식)
        const patterns = [
          /([가-힣a-zA-Z0-9\s&\-\.\(\)]{2,30})\s*(\d{4}[-\s]?\d{4}[-\s]?\d{4})/g, // 0507 형태
          /([가-힣a-zA-Z0-9\s&\-\.\(\)]{2,30})\s*(\d{3}[-\s]?\d{3,4}[-\s]?\d{4})/g, // 070 형태
          /([가-힣a-zA-Z0-9\s&\-\.\(\)]{2,30})\s*(\d{2,3}[-\s]?\d{3,4}[-\s]?\d{4})/g // 일반 형태
        ];

        for (const pattern of patterns) {
          let match;
          while ((match = pattern.exec(pageText)) !== null && results.length < 10) {
            const name = match[1].trim();
            const phone = match[2];

            if (name.length > 1 && name.length < 30 && !name.includes('전화') && !name.includes('번호')) {
              // 이미 같은 이름이 있는지 확인
              const duplicate = results.find(r => r.name === name);
              if (!duplicate) {
                results.push({
                  name,
                  phone,
                  address: '',
                  category: ''
                });
              }
            }
          }
        }

        return results;
      });

      return places;

    } catch (error) {
      console.error('텍스트 패턴 매칭 실패:', error.message);
      return [];
    }
  }

  async close() {
    try {
      if (this.page) await this.page.close();
      if (this.browser) await this.browser.close();
      console.log('🔒 브라우저 정리 완료');
    } catch (error) {
      console.log('브라우저 정리 실패:', error.message);
    }
  }
}

export default NaverMapCrawler;