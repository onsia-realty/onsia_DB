"""
네이버 지도 크롤러 테스트 - pandas 없는 간단 버전
"""
import asyncio
import json
import csv
from datetime import datetime
from playwright.async_api import async_playwright

class SimpleNaverCrawler:
    def __init__(self):
        self.results = []

    async def test_search(self):
        """간단한 테스트 크롤링"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=False,  # 테스트용으로 브라우저 창 표시
                args=[
                    "--no-sandbox",
                    "--disable-blink-features=AutomationControlled"
                ]
            )

            page = await browser.new_page(
                viewport={"width": 1920, "height": 1080},
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            )

            # 네이버 지도로 이동
            search_query = "용인시 처인구 음식점"
            search_url = f"https://map.naver.com/p/search/{search_query}"

            print(f"검색 중: {search_query}")
            await page.goto(search_url, wait_until='networkidle', timeout=30000)

            # 2초 대기
            await asyncio.sleep(2)

            # 더 긴 대기 시간
            await asyncio.sleep(5)

            try:
                # 다양한 셀렉터 시도
                selectors_to_try = [
                    '.place_bluelink',
                    '[data-id]',
                    '.search_listitem',
                    '.item_search',
                    '.search_item'
                ]

                places = None
                for selector in selectors_to_try:
                    try:
                        await page.wait_for_selector(selector, timeout=5000)
                        places = await page.query_selector_all(selector)
                        if places:
                            print(f"검색 결과 발견! (셀렉터: {selector})")
                            break
                    except:
                        continue

                if not places:
                    print("검색 결과를 찾을 수 없습니다. 페이지 HTML 일부를 확인합니다.")
                    # HTML 일부 출력
                    html_content = await page.content()
                    print("페이지 로드 완료. HTML 길이:", len(html_content))
                    return

                # 첫 5개 결과 추출
                for i, place in enumerate(places[:5]):
                    try:
                        # 다양한 셀렉터로 이름 찾기
                        name_selectors = ['.TYaxT', '.search_title', '.title', 'h3', '.name']
                        name = "N/A"
                        for name_sel in name_selectors:
                            name_element = await place.query_selector(name_sel)
                            if name_element:
                                name = await name_element.text_content()
                                if name and name.strip():
                                    name = name.strip()
                                    break

                        # 다양한 셀렉터로 주소 찾기
                        addr_selectors = ['.LDgIH', '.search_address', '.address', '.addr']
                        address = "N/A"
                        for addr_sel in addr_selectors:
                            addr_element = await place.query_selector(addr_sel)
                            if addr_element:
                                address = await addr_element.text_content()
                                if address and address.strip():
                                    address = address.strip()
                                    break

                        if name != "N/A":
                            result = {
                                "순번": i + 1,
                                "가게명": name,
                                "주소": address,
                                "검색어": search_query,
                                "크롤링시간": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                            }

                            self.results.append(result)
                            print(f"{i+1}. {name} - {address}")

                    except Exception as e:
                        print(f"개별 데이터 추출 실패: {e}")

            except Exception as e:
                print(f"전체 검색 과정 실패: {e}")

            await browser.close()

    def save_to_csv(self):
        """CSV 파일로 저장"""
        if not self.results:
            print("저장할 데이터가 없습니다.")
            return

        filename = f"test_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"

        with open(filename, 'w', newline='', encoding='utf-8-sig') as csvfile:
            if self.results:
                fieldnames = self.results[0].keys()
                writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(self.results)

        print(f"결과 저장: {filename}")
        return filename

async def main():
    print("네이버 지도 크롤러 테스트 시작")

    crawler = SimpleNaverCrawler()
    await crawler.test_search()

    if crawler.results:
        filename = crawler.save_to_csv()
        print(f"총 {len(crawler.results)}개 데이터 수집 완료")
    else:
        print("수집된 데이터가 없습니다.")

if __name__ == "__main__":
    asyncio.run(main())