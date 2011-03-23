#ifndef WEBDRIVER_IE_GETCURRENTURLCOMMANDHANDLER_H_
#define WEBDRIVER_IE_GETCURRENTURLCOMMANDHANDLER_H_

#include "Session.h"
#include "logging.h"

namespace webdriver {

class GetCurrentUrlCommandHandler : public WebDriverCommandHandler {
public:
	GetCurrentUrlCommandHandler(void) {
	}

	virtual ~GetCurrentUrlCommandHandler(void) {
	}

protected:
	void GetCurrentUrlCommandHandler::ExecuteInternal(Session* session, const LocatorMap& locator_parameters, const ParametersMap& command_parameters, WebDriverResponse * response) {
		BrowserHandle browser_wrapper;
		int status_code = session->GetCurrentBrowser(&browser_wrapper);
		if (status_code != SUCCESS) {
			response->SetErrorResponse(status_code, "Unable to get browser");
			return;
		}

		CComPtr<IHTMLDocument2> doc;
		browser_wrapper->GetDocument(&doc);

		if (!doc) {
			response->SetResponse(ENOSUCHDOCUMENT, "Unable to get document");
			return;
		}

		CComBSTR url;
		HRESULT hr = doc->get_URL(&url);
		if (FAILED(hr)) {
			LOGHR(WARN, hr) << "Unable to get current URL";
			response->SetResponse(SUCCESS, "");
			return;
		}

		std::string url_str = CW2A((LPCWSTR)url, CP_UTF8);
		response->SetResponse(SUCCESS, url_str);
	}
};

} // namespace webdriver

#endif // WEBDRIVER_IE_GETCURRENTURLCOMMANDHANDLER_H_
