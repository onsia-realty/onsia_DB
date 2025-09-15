"""
네이버 지도 크롤러 - Undetected Chrome 버전
봇 감지 우회에 특화된 Selenium 기반 크롤러
"""
import time
import logging
import random
from typing import List, Dict, Any, Optional
import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from urllib.parse import quote

from config import (
    BASE_URL, DELAY_RANGE, MAX_RETRIES,
    LOCATIONS, KEYWORDS, OUTPUT_DIR,
    OUTPUT_FILENAME_FORMAT, LOGGING_CONFIG
)
from utils import (
    setup_logging, validate_search_params,
    format_crawling_result, create_output_directory,
    generate_filename, save_to_excel
)

class UndetectedNaverCrawler:
    """Undetected Chrome을 사용한 네이버 지도 크롤러"""

    def __init__(self):
        self.logger = setup_logging(LOGGING_CONFIG)
        self.driver: Optional[uc.Chrome] = None
        self.wait: Optional[WebDriverWait] = None
        self.collected_data = []

    def __enter__(self):
        """컨텍스트 매니저 진입"""
        self.initialize_driver()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """컨텍스트 매니저 종료"""
        self.close()

    def initialize_driver(self):
        """Undetected Chrome 드라이버 초기화"""
        try:
            options = uc.ChromeOptions()

            # 기본 옵션
            options.add_argument('--no-sandbox')
            options.add_argument('--disable-dev-shm-usage')
            options.add_argument('--disable-blink-features=AutomationControlled')
            options.add_argument('--disable-extensions')
            options.add_argument('--no-first-run')
            options.add_argument('--disable-default-apps')

            # 봇 감지 우회 옵션
            options.add_argument('--disable-web-security')
            options.add_argument('--allow-running-insecure-content')
            options.add_argument('--disable-features=VizDisplayCompositor')

            # 사용자 에이전트 설정
            options.add_argument('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')

            # 윈도우 크기 설정
            options.add_argument('--window-size=1920,1080')

            # 헤드리스 모드 (필요시 주석 해제)
            # options.add_argument('--headless')

            self.driver = uc.Chrome(options=options, version_main=None)
            self.wait = WebDriverWait(self.driver, 15)

            self.logger.info("Undetected Chrome 드라이버 초기화 완료")

        except Exception as e:
            self.logger.error(f"드라이버 초기화 실패: {e}")
            raise

    def random_delay(self, min_seconds: int = 2, max_seconds: int = 5):
        """랜덤 딜레이"""
        delay = random.uniform(min_seconds, max_seconds)
        time.sleep(delay)

    def search_places(self, location: str, keyword: str) -> List[Dict[str, Any]]:
        """특정 지역과 키워드로 장소 검색"""
        if not validate_search_params(location, keyword):
            self.logger.warning(f"잘못된 검색 파라미터: {location}, {keyword}")
            return []

        search_query = f"{location} {keyword}"
        search_url = f"{BASE_URL}/{quote(search_query)}"

        try:
            self.logger.info(f"검색 시작: {search_query}")

            # 페이지 이동
            self.driver.get(search_url)
            self.random_delay(3, 6)

            # 검색 결과 대기 및 추출
            places = self.extract_place_data(location, keyword)
            self.logger.info(f"{search_query} 검색 완료: {len(places)}개 결과")

            return places

        except Exception as e:
            self.logger.error(f"검색 실패 - {search_query}: {e}")
            return []

    def extract_place_data(self, location: str, keyword: str) -> List[Dict[str, Any]]:
        """페이지에서 장소 데이터 추출"""
        places = []

        try:
            # 다양한 셀렉터로 검색 결과 찾기
            selectors_to_try = [
                "li[data-id]",
                ".place_bluelink",
                ".search_item",
                ".CHC5F",
                "[data-place-id]"
            ]

            place_elements = []
            for selector in selectors_to_try:
                try:
                    elements = self.driver.find_elements(By.CSS_SELECTOR, selector)
                    if elements:
                        self.logger.info(f"검색 결과 발견: {selector} ({len(elements)}개)")
                        place_elements = elements[:20]  # 최대 20개
                        break
                except:
                    continue

            if not place_elements:
                self.logger.warning("검색 결과를 찾을 수 없음")
                return []

            # 각 장소 데이터 추출
            for i, element in enumerate(place_elements):
                try:
                    place_data = self.extract_single_place(element)

                    if place_data.get("name"):
                        formatted_data = format_crawling_result(location, keyword, place_data)
                        places.append(formatted_data)
                        self.logger.debug(f"추출됨: {place_data['name']}")

                except Exception as e:
                    self.logger.warning(f"개별 장소 데이터 추출 실패 ({i}): {e}")
                    continue

        except Exception as e:
            self.logger.error(f"장소 데이터 추출 실패: {e}")

        return places

    def extract_single_place(self, element) -> Dict[str, Any]:
        """단일 장소에서 데이터 추출"""
        place_data = {}

        # 가게명 추출
        name_selectors = [
            ".TYaxT", ".search_title", ".title",
            "h3", ".name", "strong"
        ]
        place_data["name"] = self.extract_text_by_selectors(element, name_selectors)

        # 주소 추출
        address_selectors = [
            ".LDgIH", ".search_address", ".address",
            ".addr", ".location"
        ]
        place_data["address"] = self.extract_text_by_selectors(element, address_selectors)

        # 평점 추출
        rating_selectors = [
            ".PXMot .average", ".rating", ".score",
            ".star_score", ".review_point"
        ]
        place_data["rating"] = self.extract_text_by_selectors(element, rating_selectors)

        # 전화번호 추출
        phone_selectors = [
            ".dry01", ".phone", ".tel", ".contact"
        ]
        place_data["phone"] = self.extract_text_by_selectors(element, phone_selectors)

        # 카테고리 추출
        category_selectors = [
            ".KCMnt", ".category", ".type", ".business_type"
        ]
        place_data["category"] = self.extract_text_by_selectors(element, category_selectors)

        return place_data

    def extract_text_by_selectors(self, parent_element, selectors: List[str], default: str = "") -> str:
        """여러 셀렉터를 시도하여 텍스트 추출"""
        for selector in selectors:
            try:
                element = parent_element.find_element(By.CSS_SELECTOR, selector)
                text = element.text.strip()
                if text:
                    return text
            except (NoSuchElementException, Exception):
                continue
        return default

    def crawl_all_locations(self) -> List[Dict[str, Any]]:
        """모든 지역과 키워드 조합으로 크롤링"""
        all_data = []

        for location in LOCATIONS:
            for keyword in KEYWORDS:
                retry_count = 0

                while retry_count < MAX_RETRIES:
                    try:
                        places = self.search_places(location, keyword)
                        all_data.extend(places)
                        break

                    except Exception as e:
                        retry_count += 1
                        self.logger.warning(f"재시도 {retry_count}/{MAX_RETRIES} - {location} {keyword}: {e}")

                        if retry_count < MAX_RETRIES:
                            self.random_delay(10, 15)  # 재시도 전 더 긴 대기
                        else:
                            self.logger.error(f"최대 재시도 횟수 초과: {location} {keyword}")

                # 요청 간 딜레이
                self.random_delay(*DELAY_RANGE)

        return all_data

    def run(self) -> str:
        """크롤링 실행"""
        try:
            self.logger.info("Undetected 네이버 지도 크롤링 시작")

            # 출력 디렉토리 생성
            create_output_directory(OUTPUT_DIR)

            # 크롤링 실행
            data = self.crawl_all_locations()

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

    def close(self):
        """리소스 정리"""
        try:
            if self.driver:
                self.driver.quit()
            self.logger.info("드라이버 정리 완료")
        except Exception as e:
            self.logger.error(f"드라이버 정리 실패: {e}")


def main():
    """메인 실행 함수"""
    with UndetectedNaverCrawler() as crawler:
        try:
            result_file = crawler.run()
            print(f"✅ 크롤링 완료! 결과 파일: {result_file}")
        except Exception as e:
            print(f"❌ 크롤링 실패: {e}")


if __name__ == "__main__":
    main()