"""
네이버 지도 크롤러 데모 - 더 안정적인 버전
"""
import asyncio
import csv
from datetime import datetime
from playwright.async_api import async_playwright

async def test_naver_map():
    """안정적인 네이버 지도 크롤링 데모"""
    print("=== 네이버 지도 크롤러 데모 ===")

    async with async_playwright() as p:
        # 브라우저 시작
        browser = await p.chromium.launch(
            headless=True,  # headless 모드
            args=[
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--disable-blink-features=AutomationControlled",
                "--disable-web-security"
            ]
        )

        try:
            # 새 페이지 생성
            page = await browser.new_page(
                viewport={"width": 1280, "height": 720},
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            )

            # 간단한 검색으로 시작
            search_query = "용인 음식점"
            url = f"https://map.naver.com/p/search/{search_query}"

            print(f"1. 페이지 로드 중: {url}")

            # 페이지 이동
            response = await page.goto(url, wait_until='domcontentloaded', timeout=30000)
            print(f"2. 응답 상태: {response.status}")

            # 로딩 대기
            await asyncio.sleep(3)

            # 페이지 제목 확인
            title = await page.title()
            print(f"3. 페이지 제목: {title}")

            # 검색 결과 요소 찾기
            print("4. 검색 결과 요소 탐색 중...")

            # 다양한 선택자 시도
            possible_selectors = [
                'li[data-id]',
                '.CHC5F',
                '.place_bluelink',
                '.search_item',
                '[data-place-id]'
            ]

            found_elements = []
            for selector in possible_selectors:
                try:
                    elements = await page.query_selector_all(selector)
                    if elements:
                        print(f"   - {selector}: {len(elements)}개 발견")
                        found_elements = elements[:3]  # 처음 3개만
                        break
                except Exception as e:
                    print(f"   - {selector}: 실패 ({e})")

            if found_elements:
                print("5. 데이터 추출 중...")
                results = []

                for i, element in enumerate(found_elements):
                    try:
                        # 텍스트 내용 추출
                        text_content = await element.text_content()
                        if text_content and text_content.strip():
                            result = {
                                "번호": i + 1,
                                "내용": text_content.strip()[:100],  # 처음 100자만
                                "검색어": search_query,
                                "시간": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                            }
                            results.append(result)
                            print(f"   {i+1}. {result['내용']}")

                    except Exception as e:
                        print(f"   - 요소 {i+1} 추출 실패: {e}")

                # CSV 저장
                if results:
                    filename = f"demo_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
                    with open(filename, 'w', newline='', encoding='utf-8-sig') as f:
                        writer = csv.DictWriter(f, fieldnames=results[0].keys())
                        writer.writeheader()
                        writer.writerows(results)

                    print(f"6. 결과 저장 완료: {filename}")
                    print(f"   총 {len(results)}개 데이터 수집")

                else:
                    print("6. 추출된 데이터가 없음")

            else:
                print("5. 검색 결과 요소를 찾을 수 없음")

                # 현재 URL 확인
                current_url = page.url
                print(f"   현재 URL: {current_url}")

                # 페이지 소스 일부 확인
                html = await page.content()
                print(f"   HTML 길이: {len(html)} 문자")

        except Exception as e:
            print(f"오류 발생: {e}")

        finally:
            await browser.close()
            print("브라우저 종료 완료")

if __name__ == "__main__":
    asyncio.run(test_naver_map())