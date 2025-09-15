"""
네이버 지도 크롤러 메인 클래스
Playwright를 사용한 최적화된 웹 크롤링 구현
"""
import asyncio
import logging
from typing import List, Dict, Any, Optional
from playwright.async_api import async_playwright, Browser, Page
from urllib.parse import quote

from config import (
    BASE_URL, DELAY_RANGE, MAX_RETRIES, BROWSER_CONFIG,
    LOCATIONS, KEYWORDS, SELECTORS, OUTPUT_DIR,
    OUTPUT_FILENAME_FORMAT, LOGGING_CONFIG, RATE_LIMIT
)
from utils import (
    setup_logging, random_delay, validate_search_params,
    extract_text_content, format_crawling_result,
    create_output_directory, generate_filename, save_to_excel
)

class OptimizedNaverCrawler:
    """네이버 지도 크롤러 최적화 클래스"""

    def __init__(self):
        self.logger = setup_logging(LOGGING_CONFIG)
        self.browser: Optional[Browser] = None
        self.page: Optional[Page] = None
        self.collected_data = []

    async def __aenter__(self):
        """비동기 컨텍스트 매니저 진입"""
        await self.initialize_browser()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """비동기 컨텍스트 매니저 종료"""
        await self.close()

    async def initialize_browser(self):
        """브라우저 초기화"""
        try:
            self.playwright = await async_playwright().start()
            self.browser = await self.playwright.chromium.launch(
                headless=BROWSER_CONFIG["headless"],
                args=BROWSER_CONFIG["args"]
            )

            self.page = await self.browser.new_page(
                viewport=BROWSER_CONFIG["viewport"],
                user_agent=BROWSER_CONFIG["user_agent"]
            )

            # 추가 안티 디텍션 설정
            await self.page.add_init_script("""
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => undefined,
                });
            """)

            self.logger.info("브라우저 초기화 완료")

        except Exception as e:
            self.logger.error(f"브라우저 초기화 실패: {e}")
            raise

    async def search_places(self, location: str, keyword: str) -> List[Dict[str, Any]]:
        """특정 지역과 키워드로 장소 검색"""
        if not validate_search_params(location, keyword):
            self.logger.warning(f"잘못된 검색 파라미터: {location}, {keyword}")
            return []

        search_query = f"{location} {keyword}"
        search_url = f"{BASE_URL}/{quote(search_query)}"

        try:
            self.logger.info(f"검색 시작: {search_query}")

            # 페이지 이동 및 로딩 대기
            await self.page.goto(search_url, wait_until='networkidle', timeout=30000)
            await random_delay(*DELAY_RANGE)

            # 검색 결과 대기
            try:
                await self.page.wait_for_selector('.place_bluelink', timeout=10000)
            except:
                self.logger.warning(f"검색 결과를 찾을 수 없음: {search_query}")
                return []

            # 데이터 추출
            places = await self.extract_place_data(location, keyword)
            self.logger.info(f"{search_query} 검색 완료: {len(places)}개 결과")

            return places

        except Exception as e:
            self.logger.error(f"검색 실패 - {search_query}: {e}")
            return []

    async def extract_place_data(self, location: str, keyword: str) -> List[Dict[str, Any]]:
        """페이지에서 장소 데이터 추출"""
        places = []

        try:
            # 장소 목록 요소들 가져오기
            place_elements = await self.page.query_selector_all('.place_bluelink')

            for element in place_elements[:20]:  # 최대 20개 결과만
                try:
                    place_data = {}

                    # 각 데이터 필드 추출
                    name_element = await element.query_selector('.TYaxT')
                    place_data["name"] = extract_text_content(name_element)

                    address_element = await element.query_selector('.LDgIH')
                    place_data["address"] = extract_text_content(address_element)

                    rating_element = await element.query_selector('.PXMot .place_score .average')
                    place_data["rating"] = extract_text_content(rating_element)

                    phone_element = await element.query_selector('.dry01')
                    place_data["phone"] = extract_text_content(phone_element)

                    category_element = await element.query_selector('.KCMnt')
                    place_data["category"] = extract_text_content(category_element)

                    # 기본 데이터가 있을 때만 추가
                    if place_data["name"]:
                        formatted_data = format_crawling_result(location, keyword, place_data)
                        places.append(formatted_data)

                except Exception as e:
                    self.logger.warning(f"개별 장소 데이터 추출 실패: {e}")
                    continue

        except Exception as e:
            self.logger.error(f"장소 데이터 추출 실패: {e}")

        return places

    async def crawl_all_locations(self) -> List[Dict[str, Any]]:
        """모든 지역과 키워드 조합으로 크롤링"""
        all_data = []

        for location in LOCATIONS:
            for keyword in KEYWORDS:
                retry_count = 0

                while retry_count < MAX_RETRIES:
                    try:
                        places = await self.search_places(location, keyword)
                        all_data.extend(places)
                        break  # 성공시 재시도 루프 종료

                    except Exception as e:
                        retry_count += 1
                        self.logger.warning(f"재시도 {retry_count}/{MAX_RETRIES} - {location} {keyword}: {e}")

                        if retry_count < MAX_RETRIES:
                            await random_delay(5, 10)  # 재시도 전 더 긴 대기
                        else:
                            self.logger.error(f"최대 재시도 횟수 초과: {location} {keyword}")

                # 요청 간 딜레이
                await random_delay(*DELAY_RANGE)

        return all_data

    async def run(self) -> str:
        """크롤링 실행"""
        try:
            self.logger.info("네이버 지도 크롤링 시작")

            # 출력 디렉토리 생성
            create_output_directory(OUTPUT_DIR)

            # 크롤링 실행
            data = await self.crawl_all_locations()

            if not data:
                raise ValueError("크롤링된 데이터가 없습니다.")

            # 엑셀 파일로 저장
            filename = generate_filename(OUTPUT_FILENAME_FORMAT)
            filepath = save_to_excel(data, filename, OUTPUT_DIR)

            self.logger.info(f"크롤링 완료. 총 {len(data)}개 데이터 저장: {filepath}")
            return filepath

        except Exception as e:
            self.logger.error(f"크롤링 실행 실패: {e}")
            raise

    async def close(self):
        """리소스 정리"""
        try:
            if self.page:
                await self.page.close()
            if self.browser:
                await self.browser.close()
            if hasattr(self, 'playwright'):
                await self.playwright.stop()
            self.logger.info("브라우저 정리 완료")
        except Exception as e:
            self.logger.error(f"브라우저 정리 실패: {e}")


async def main():
    """메인 실행 함수"""
    async with OptimizedNaverCrawler() as crawler:
        try:
            result_file = await crawler.run()
            print(f"✅ 크롤링 완료! 결과 파일: {result_file}")
        except Exception as e:
            print(f"❌ 크롤링 실패: {e}")


if __name__ == "__main__":
    asyncio.run(main())