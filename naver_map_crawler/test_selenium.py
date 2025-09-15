"""
Undetected Chrome 크롤러 간단 테스트
"""
import time
import csv
from datetime import datetime
import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
from selenium.common.exceptions import TimeoutException, NoSuchElementException

def test_undetected_crawler():
    """Undetected Chrome으로 네이버 지도 테스트"""
    print("=== Undetected Chrome 네이버 지도 테스트 ===")

    # Chrome 옵션 설정
    options = uc.ChromeOptions()
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--disable-blink-features=AutomationControlled')
    options.add_argument('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')

    driver = None
    try:
        # Undetected Chrome 시작
        print("1. Undetected Chrome 시작 중...")
        driver = uc.Chrome(options=options)

        # 네이버 지도로 이동
        search_query = "용인 음식점"
        url = f"https://map.naver.com/p/search/{search_query}"

        print(f"2. 페이지 이동: {url}")
        driver.get(url)

        # 잠시 대기
        print("3. 페이지 로딩 대기 (10초)...")
        time.sleep(10)

        # 페이지 제목 확인
        title = driver.title
        print(f"4. 페이지 제목: {title}")

        # 검색 결과 찾기
        print("5. 검색 결과 탐색 중...")

        selectors = [
            "li[data-id]",
            ".place_bluelink",
            ".CHC5F",
            ".search_item"
        ]

        results = []
        found = False

        for selector in selectors:
            try:
                elements = driver.find_elements(By.CSS_SELECTOR, selector)
                if elements:
                    print(f"   - {selector}: {len(elements)}개 발견!")

                    # 처음 3개만 추출
                    for i, elem in enumerate(elements[:3]):
                        try:
                            text = elem.text.strip()
                            if text:
                                result = {
                                    "번호": i + 1,
                                    "내용": text[:200],  # 200자로 제한
                                    "검색어": search_query,
                                    "시간": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                                }
                                results.append(result)
                                print(f"   {i+1}. {text[:100]}...")
                        except Exception as e:
                            print(f"   요소 추출 실패: {e}")

                    found = True
                    break

            except Exception as e:
                print(f"   - {selector}: 실패 ({e})")

        if not found:
            print("   검색 결과를 찾을 수 없음")
            # 현재 URL 확인
            print(f"   현재 URL: {driver.current_url}")

            # 페이지 소스 일부 확인
            page_source = driver.page_source
            print(f"   페이지 소스 길이: {len(page_source)}")

            # CAPTCHA 확인
            if "captcha" in page_source.lower() or "보안" in page_source:
                print("   WARNING: CAPTCHA 또는 보안 검증 페이지 감지됨")

        # 결과 저장
        if results:
            filename = f"selenium_test_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
            with open(filename, 'w', newline='', encoding='utf-8-sig') as f:
                writer = csv.DictWriter(f, fieldnames=results[0].keys())
                writer.writeheader()
                writer.writerows(results)

            print(f"6. 결과 저장: {filename}")
            print(f"   총 {len(results)}개 데이터 수집")
        else:
            print("6. 수집된 데이터 없음")

    except Exception as e:
        print(f"오류 발생: {e}")

    finally:
        if driver:
            print("브라우저 종료 중...")
            time.sleep(2)  # 안전한 종료를 위한 대기
            driver.quit()
            print("테스트 완료!")

if __name__ == "__main__":
    test_undetected_crawler()