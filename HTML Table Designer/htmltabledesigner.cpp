//============================================================================
// Author: C. Drozdowski. MIT license.
//============================================================================
#include <Origin.h>
#include <../OriginLab/DialogEx.h>
#include <../OriginLab/HTMLDlg.h>
#include <GetNBox.h>


// Constants for dialog.
#define HTML_TABLE_DESIGNER_DLG_INIT_WIDTH			650
#define HTML_TABLE_DESIGNER_DLG_INIT_HEIGHT			500
#define HTML_TABLE_DESIGNER_DLG_MIN_WIDTH			650
#define HTML_TABLE_DESIGNER_DLG_MIN_HEIGHT			500

#define STR_HTML_TABLE_DESIGNER_USER_STYLES_FOLDER	"User Styles"
#define STR_HTML_TABLE_DESIGNER_ORIGIN_TABLE_CSS_CLASS	".origin-table"
#define STR_HTML_TABLE_DESIGNER_STYLE_ID "html-table-designer-styles"
#define STR_HTML_TABLE_DESIGNER_STYLE_COMMENT_BEGIN "<!-- Begin HTML Table Designer Styles -->"
#define STR_HTML_TABLE_DESIGNER_STYLE_COMMENT_END "<!-- End HTML Table Designer Styles -->"
#define STR_HTML_TABLE_DESIGNER_CSS_COMMENT_RESET "/* Reset Origin-generated table styles */"
#define STR_HTML_TABLE_DESIGNER_CSS_COMMENT_APP "/* App-generated table styles */"


class clsStyleList
{
public:
	vector<string> styles;
	clsStyleList()
	{
	}
};


class HTMLTableDesignerDlg;
static HTMLTableDesignerDlg *s_pHTMLTableDesignerDlg = NULL;

class HTMLTableDesignerDlg : public HTMLDlg
{
public:
	HTMLTableDesignerDlg()
	{
		waitCursor junk;
		m_pvar = new LTVarTempChange("@HTDD", 1);

		m_strSettings = LoadJsonConfigFile("settings.json");
		m_strResetStyles = LoadResetStyles();
		m_strPreview = LoadPreview();
		m_strIntro = LoadIntro();
	}

	~HTMLTableDesignerDlg()
	{
		if( m_pvar )
			NICE_SAFE_REMOVAL(m_pvar);
	}

	int Create(HWND hParent = NULL, DWORD dwOptions = 0)
	{
		InitMsgMap();
		int nRet = HTMLDlg::Create(hParent, dwOptions);
		ModifyStyle(0, WS_MAXIMIZEBOX | WS_MINIMIZEBOX);

		return nRet;
	}

	string LoadStyleList()
	{
		return GetStyleList();
	}

	string LoadStyle(string strName)
	{
		return DoLoadStyle(strName);
	}

	string SaveStyle(string strName, string strCss)
	{
		if( !_SaveStyleDialog(strName) )
			return "";

		if( !DoSaveStyle(strName, strCss) )
			return "";

		return strName;
	}

	bool ExportStyle(string strName, string strCss)
	{
		string strFile = GetSaveAsBox("*.css Cascading Style Sheet File", NULL, strName);
		if( strFile.IsEmpty() )
			return false;

		return SaveCssFile(strFile, strCss);
	}

	string ImportStyle()
	{
		string strFile = GetOpenBox("*.css Cascading Style Sheet File", NULL);
		return DoImportStyle(strFile);
	}

	bool PreviewStyle(string strCss)
	{
		string str = m_strPreview;
		str.Replace("APP_STYLES", FormatCombinedStyle(strCss));

		if( str.IsEmpty() )
			return false;

		if( !m_notePreview.IsValid() )
			m_notePreview.Create();

		if( !m_notePreview.IsValid() )
			return false;

		m_notePreview.Text = str;

		m_notePreview.CheckShowActivate();

		// Set Notes window to HTML mode.
		LT_execute("note.syntax=1;");
		LT_execute("note.view=1;");

		return true;
	}

	bool ApplyStyle(string strCss)
	{
		// Create the full styles to put into report.
		string strStyles = FormatCombinedStyle(strCss);

		// Copy full styles to clipboard as a safety move.
		copy_to_clipboard(strStyles, true, false);

		// Test if active window is a Note and is not the preview.
		Note note = Project.Notes();
		if (!note.IsValid())
		{
			ErrorMsg("An HTML report is not the active window.");
			return false;
		}
		if (m_notePreview.IsValid() && note == m_notePreview)
		{
			ErrorMsg("Styles cannot be applied to the Preview window.");
			return false;
		}

		// Get Note syntax and if not HTML or Markdown, error and return.
		double syntax = 0;
		LT_get_var("note.syntax", &syntax);
		if (0 == syntax)
		{
			ErrorMsg("The Active Note window isn't set up as an HTML report. Its syntax is neither HTML nor Markdown.");
			return false;
		}

		// If Markdown, need to remove class selector.
		if (2 == syntax)
			strStyles.Replace(STR_HTML_TABLE_DESIGNER_ORIGIN_TABLE_CSS_CLASS, "");

		// Get text of Note window.
		string strText = note.Text;

		// Look for and replace any pre-existing App-based styles in Note text and return.
		int nPosBegin = strText.Find(STR_HTML_TABLE_DESIGNER_STYLE_COMMENT_BEGIN);
		if (nPosBegin > -1)
		{
			int nPosEnd = strText.Find(STR_HTML_TABLE_DESIGNER_STYLE_COMMENT_END, nPosBegin);
			if (-1 == nPosEnd)
			{
				ErrorMsg("Unable to replace styles- missing delimter comment.");
				return false;
			}
			nPosEnd += strlen(STR_HTML_TABLE_DESIGNER_STYLE_COMMENT_END) - 1;
			string strNew = StripStyles(strText, nPosBegin, nPosEnd);
			strNew.TrimLeft();
			strStyles.TrimRight(); // It ends with \r\n and if left in, will keep adding them to content every time updated. So remove trailing \r\n's.
			strNew.Insert(nPosBegin, strStyles);
			note.Text = strNew;
			return true;
		}

		// Otherwise, for Markdown syntax, Insert at beginning and return.
		if (2 == syntax)
		{
			string strNew;
			strNew.Format("%s%s", strStyles, strText);
			note.Text = strNew;
			return true;
		}

		// Otherwise, for HTML syntax...

		// Look for <head> element by searching for </head> because, if it exists,
		// we will insert before </head> and return.
		int nPosHead = strText.Find("</head>");
		if (nPosHead > -1)
		{
			strText.Insert(nPosHead, strStyles);
			note.Text = strText;
			return true;
		}

		// Look for <body> element by searching for <body> because, if it exists,
		// we will insert after </body> and return.
		int nPosBody = strText.Find("<body>");
		if (nPosBody > -1)
		{
			strText.Insert(nPosBody + strlen("<body>"), strStyles);
			note.Text = strText;
			return true;
		}

		// If no <head> or <body>, then we don't insert- HTML isn't
		// complete enough error and return false.
		ErrorMsg("The active HTML report does not contain either <head> or <body> elements. One of them is required to apply styles.");
		return false;
	}

	string GetIntro()
	{
		return m_strIntro;
	}

	bool CloseClick()
	{
		if( m_notePreview.IsValid() )
			m_notePreview.Destroy();

		Close();

		return true;
	}

	string LoadSettings()
	{
		string strJson = (!m_strSettings.IsEmpty()) ? m_strSettings : "{}";
		return strJson;
	}

	void SaveSettings(string strJson)
	{
		SaveJsonConfigFile("settings.json", strJson);
	}

	// Javascript-callable MessageBox() wrapper providing more options that Javascript
	// versions not the least of which that it allows dialog title to be set.
	// See mswin.h for constants for type and return value.
	int OCMessageBox(string strText, string strCaption, int nType = MB_OK)
	{
		if( strCaption.IsEmpty() )
			strCaption = GetDialogTitle();

		// int OWINAPI MessageBox( HWND hWnd, LPCSTR lpText, LPCSTR lpCaption = NULL, UINT uType = MB_OK );	// Open a Windows message box.
		// See mswin.h for constants related to type and return values.
		return MessageBox(GetSafeHwnd(), strText, strCaption, nType);
	}

protected:
	DECLARE_DISPATCH_MAP

	EVENTS_BEGIN_DERIV(HTMLDlg)
		ON_CANCEL(OnCancel)
		ON_DESTROY(OnDestroy)
		ON_SIZE(OnDlgResize)
		ON_GETMINMAXINFO(OnMinMaxInfo)
		ON_SYSCOMMAND(OnSystemCommand)
	EVENTS_END_DERIV

	BOOL OnCancel()
	{
		// When Origin exits with this dialog open, this gets called.
		// If it is exiting, don't call CloseClick because it prompts
		// for saving which may lead to crash.
		double dCW;
		LT_get_var("@CW", &dCW);
		if (2 == dCW)
			return TRUE;

		CloseClick();
		return TRUE;
	}

	string GetInitURL()
	{
		string strFile = __FILE__;
		return GetFilePath(strFile) + "app.html";
	}

	string GetDialogTitle() {return "HTML Table Designer";}

	BOOL OnDestroy()
	{
		HTMLDlg::OnDestroy();
		s_pHTMLTableDesignerDlg = NULL;
		delete this;
		return TRUE;
	}

	BOOL GetDlgInitSize(int& width, int& height)
	{
		width = HTML_TABLE_DESIGNER_DLG_INIT_WIDTH;
		height = HTML_TABLE_DESIGNER_DLG_INIT_HEIGHT;
		return TRUE;
	}

	BOOL OnDlgResize(int nType, int cx, int cy)
	{
		if( !IsInitReady() )
			return false;

		// MoveControlsHelper _temp(this); // you can uncomment this line, if the dialog flickers when you resize it
		HTMLDlg::OnDlgResize(nType, cx, cy);
		if( !IsHTMLDocumentCompleted() )
			return FALSE;

		return TRUE;
	}

	int	GetMinClientTrackWidth()
	{
		return CheckConvertDlgSizeWithDPI(HTML_TABLE_DESIGNER_DLG_MIN_WIDTH, true);
	}

	int	GetMinClientTrackHeight()
	{
		return CheckConvertDlgSizeWithDPI(HTML_TABLE_DESIGNER_DLG_MIN_HEIGHT, false);
	}

	bool OnSystemCommand(int nCmd)
	{
		if (SC_MAXIMIZE == nCmd)
		{
			return FALSE;
		}

		if (SC_MINIMIZE == nCmd)
		{
			if(!IsRolledup())
			{
				Rollup(true);
				if (m_notePreview)
					m_notePreview.GetWindow().ShowWindow(SW_HIDE);

			}
			else
			{
				Rollup(FALSE);
				if (m_notePreview)
				{
					m_notePreview.GetWindow().ShowWindow(SW_SHOW);
					m_notePreview.CheckShowActivate();
				}
			}

			return FALSE;
		}

		return TRUE;
		//return HTMLDlg::OnSystemCommand(nCmd);
	}

private:

	string FormatCombinedStyle(const string& strCss)
	{
		string str;
		str.Format("%s\n<style id=\"%s\">\n%s</style>\n%s\n",
			STR_HTML_TABLE_DESIGNER_STYLE_COMMENT_BEGIN,
			STR_HTML_TABLE_DESIGNER_STYLE_ID,
			FormatCss(strCss),
			STR_HTML_TABLE_DESIGNER_STYLE_COMMENT_END
		);
		return str;
	}

	string FormatCss(const string& strCss)
	{
		string str;
		str.Format("%s\n%s\n\n%s\n%s",
			STR_HTML_TABLE_DESIGNER_CSS_COMMENT_RESET,
			m_strResetStyles,
			STR_HTML_TABLE_DESIGNER_CSS_COMMENT_APP,
			strCss
		);
		return str;
	}

	string StripStyles(LPCSTR in, int nBegin, int nEnd)
	{
		if (nEnd <= nBegin)
			return in;

		string str;
		int len = strlen(in) + nEnd - nBegin + 1;
		LPSTR out = str.GetBuffer(len+1);
		memset(out, 0, len+1);

		int nPos = 0;
		while (*in)
		{
			if (nPos == nBegin)
			{
				while (*in && nPos <= nEnd)
				{
					in++;
					nPos++;
				}
				continue;
			}

			*out = *in;
			out++;
			in++;
			nPos++;
		}

		str.ReleaseBuffer();
		return str;
	}

	void ErrorMsg(LPCSTR msg)
	{
		MessageBox(GetSafeHwnd(), msg, GetDialogTitle(), MB_OK|MB_ICONEXCLAMATION);
	}

	string DoLoadStyle(string strName)
	{
		string strCss;

		strName += ".css";
		strName = GetFileName(strName, false);

		string strTemp = __FILE__;
		string strPath = GetFilePath(strTemp) + STR_HTML_TABLE_DESIGNER_USER_STYLES_FOLDER;
		string strFile;
		strFile.Format("%s/%s", strPath, strName);

		if( strFile.IsFile() )
		{
			stdioFile ff;
			if( ff.Open(strFile, file::modeRead | file::typeText) )
			{
				strCss = "";
				string strLine;
				while( ff.ReadString(strLine) )
				{
					strCss += strLine;
				}
				ff.Close();
			}
		}

		return strCss;
	}

	string DoImportStyle(const string& strFile)
	{
		string strCss;

		if( strFile.IsFile() )
		{
			stdioFile ff;
			if( ff.Open(strFile, file::modeRead | file::typeText) )
			{
				strCss = "";
				string strLine;
				while( ff.ReadString(strLine) )
				{
					strCss += strLine;
				}
				ff.Close();
			}
		}

		return strCss;
	}

	bool DoSaveStyle(string& strName, const string& strCss)
	{
		if( strName.IsEmpty() )
			return false;

		if( 0 != strName.Right(4).CompareNoCase(".css") )
			strName += ".css";

		// Make sure it is only a file name with no path component.
		strName = GetFileName(strName, true);

		string strTemp = __FILE__;
		string strPath = GetFilePath(strTemp) + STR_HTML_TABLE_DESIGNER_USER_STYLES_FOLDER;
		string strFile;
		strFile.Format("%s/%s.%s", strPath, strName, "css");

		bool bRet = false;
		stdioFile ff;
		if( ff.Open(strFile, file::modeCreate | file::modeWrite | file::typeText) )
		{
			ff.WriteString(strCss);
			ff.Close();
			bRet = true;
		}

		return bRet;
	}

	string GetStyleList()
	{
		string strJson;

		clsStyleList cls;
		vector<string> vs;

		string strTemp = __FILE__;
		string strPath = GetFilePath(strTemp) + STR_HTML_TABLE_DESIGNER_USER_STYLES_FOLDER;

		FindFiles(vs, strPath, "*.css", true, 0);

		int nSize = vs.GetSize();
		for( int nn = 0; nn < nSize; nn++ )
		{
			vs[nn] = GetFileName(vs[nn], true);
		}

		cls.styles = vs;

		JSON.ToString(cls, strJson);
		return strJson;
	}

	string LoadOriginStyles()
	{
		string strRet = "";

		string strFile = GetOriginPath(ORIGIN_PATH_SYSTEM) + "Ohtml/NotePage/styles/global.css";

		if( strFile.IsFile() )
		{
			stdioFile ff;
			if( ff.Open(strFile, file::modeRead | file::typeText) )
			{
				strRet = "";
				string strLine;
				while( ff.ReadString(strLine) )
				{
					strRet += strLine + "\n";
				}
				ff.Close();
			}
		}

		strRet.TrimLeft();
		strRet.TrimRight();

		return strRet;
	}

	string LoadResetStyles()
	{
		string strRet = "";

		string strTemp = __FILE__;
		string strPath = GetFilePath(strTemp);
		string strFile = strPath + "resetstyles.css";

		if( strFile.IsFile() )
		{
			stdioFile ff;
			if( ff.Open(strFile, file::modeRead | file::typeText) )
			{
				strRet = "";
				string strLine;
				while( ff.ReadString(strLine) )
				{
					strRet += strLine + "\n";
				}
				ff.Close();
			}
		}

		strRet.TrimLeft();
		strRet.TrimRight();

		return strRet;
	}

	string LoadPreview()
	{
		string strRet = "";

		string strTemp = __FILE__;
		string strPath = GetFilePath(strTemp);
		string strFile = strPath + "preview.html";

		if( strFile.IsFile() )
		{
			stdioFile ff;
			if( ff.Open(strFile, file::modeRead | file::typeText) )
			{
				strRet = "";
				string strLine;
				while( ff.ReadString(strLine) )
				{
					strRet += strLine + "\n";
				}
				ff.Close();
			}
		}

		strRet.Replace("ORIGIN_STYLES", LoadOriginStyles());

		return strRet;
	}

	string LoadIntro()
	{
		string strRet = "";

		string strTemp = __FILE__;
		string strPath = GetFilePath(strTemp);
		string strFile = strPath + "intro.html";

		if( strFile.IsFile() )
		{
			stdioFile ff;
			if( ff.Open(strFile, file::modeRead | file::typeText) )
			{
				strRet = "";
				string strLine;
				while( ff.ReadString(strLine) )
				{
					strRet += strLine + "\n";
				}
				ff.Close();
			}
		}

		return strRet;
	}

	bool SaveCssFile(string strFile, string strCss)
	{

		if( strFile.IsEmpty() )
			return false;

		bool bRet = false;
		stdioFile ff;
		if( ff.Open(strFile, file::modeCreate | file::modeWrite | file::typeText) )
		{
			ff.WriteString(strCss);
			ff.Close();
			bRet = true;
		}

		return bRet;
	}

	string LoadJsonConfigFile(string strFile)
	{
		string strJson = "{}";

		string strTemp = __FILE__;
		strFile = GetFilePath(strTemp) + strFile;

		if( strFile.IsFile() )
		{
			stdioFile ff;
			if( ff.Open(strFile, file::modeRead | file::typeText) )
			{
				strJson = "";
				string strLine;
				while( ff.ReadString(strLine) )
				{
					if( 0 != strLine.Left(2).Compare("//") )
						strJson += strLine;
				}
				ff.Close();
			}

			if( strJson.IsEmpty() )
				strJson = "{}";
		}

		return strJson;
	}

	bool SaveJsonConfigFile(string strFile, string strJson)
	{
		if( strJson.IsEmpty() )
			strJson = "{}";

		string strTemp = __FILE__;
		strFile = GetFilePath(strTemp) + strFile;

		bool bRet = false;
		stdioFile ff;
		if( ff.Open(strFile, file::modeCreate | file::modeWrite | file::typeText) )
		{
			ff.WriteString(strJson);
			ff.Close();
			bRet = true;
		}

		return bRet;
	}

private:
	Note m_notePreview;
	string m_strResetStyles;
	string m_strPreview;
	string m_strIntro;
	string m_strSettings;
	LTVarTempChange* m_pvar;

}; //End class HTMLTableDesignerDlg.

BEGIN_DISPATCH_MAP(HTMLTableDesignerDlg, HTMLDlg)
	DISP_FUNCTION(HTMLTableDesignerDlg, LoadStyleList, VTS_STR, VTS_VOID)
	DISP_FUNCTION(HTMLTableDesignerDlg, LoadStyle, VTS_STR, VTS_STR)
	DISP_FUNCTION(HTMLTableDesignerDlg, SaveStyle, VTS_STR, VTS_STR VTS_STR)
	DISP_FUNCTION(HTMLTableDesignerDlg, ExportStyle, VTS_BOOL, VTS_STR VTS_STR)
	DISP_FUNCTION(HTMLTableDesignerDlg, ImportStyle, VTS_STR, VTS_VOID)
	DISP_FUNCTION(HTMLTableDesignerDlg, PreviewStyle, VTS_BOOL, VTS_STR)
	DISP_FUNCTION(HTMLTableDesignerDlg, ApplyStyle, VTS_BOOL, VTS_STR)
	DISP_FUNCTION(HTMLTableDesignerDlg, LoadSettings, VTS_STR, VTS_VOID)
	DISP_FUNCTION(HTMLTableDesignerDlg, GetIntro, VTS_STR, VTS_VOID)
	DISP_FUNCTION(HTMLTableDesignerDlg, SaveSettings, VTS_VOID, VTS_STR)
	DISP_FUNCTION(HTMLTableDesignerDlg, CloseClick, VTS_BOOL, VTS_VOID)
	DISP_FUNCTION(HTMLTableDesignerDlg, OCMessageBox, VTS_I4, VTS_STR VTS_STR VTS_I4)
END_DISPATCH_MAP


// Dialog to get style name from user.
static bool _SaveStyleDialog(string& strName) // Note pass by reference.
{
	strName.TrimLeft();
	strName.TrimRight();

	if( s_pHTMLTableDesignerDlg == NULL )
		return false;

	string strJson = s_pHTMLTableDesignerDlg->LoadStyleList();
	clsStyleList cls;
	JSON.FromString(cls, strJson);
	vector<string> vsList;
	vsList = cls.styles;
	string strList;
	strList.SetTokens(vsList, '|');

	int nID = 100;
	GETN_TREE(tr)
	GETN_STRLIST(name, "Style Name", strName, "|" + strList) GETN_ID(nID++)

	// Hidden lookup list.
	tr.list.strVals = vsList;
	tr.list.SetAttribute(STR_SHOW_ATTRIB, false);

	tr.save.nVal = 0;
	tr.save.SetAttribute(STR_SHOW_ATTRIB, false);

	if( !GetNBox(tr, _DlgEventFunc, "Save Style", "Enter or select an existing name with which to save the current style.") )
		return false;

	strName = tr.name.strVal;
	bool bRet = (1 == tr.save.nVal);

	return bRet;
}

// Dialog event function for _SaveStyleDialog above.
static int _DlgEventFunc(TreeNode& tr, int nRow, int nEvent, DWORD& dwEnables, LPCSTR lpcszNodeName, WndContainer& getNContainer, string& strAux, string& strErrMsg)
{
	if( nEvent < 0 && GETNE_ON_INIT == nEvent )
	{
		O_SET_BIT(dwEnables, GETNGEVT_OK_ENABLE,!tr.name.strVal.IsEmpty());
		return true;
	}

	if( nEvent < 0 && GETNE_ON_VALUE_CHANGE == nEvent )
	{
		tr.name.strVal.TrimLeft();
		tr.name.strVal.TrimRight();
		if( tr.name.strVal.IsEmpty() )
		{
			O_SET_BIT(dwEnables, GETNGEVT_OK_ENABLE, false);
			return true;
		}

		if ( !is_str_valid_for_filename(tr.name.strVal) )
		{
			MessageBox(getNContainer.GetSafeHwnd(), "Style name contains invalid characters.\r\n\r\nIt is restricted to the same characters allowed in file names.", "Save Style", MB_OK | MB_ICONSTOP);
			O_SET_BIT(dwEnables, GETNGEVT_OK_ENABLE, false);
			return true;
		}
	}

	if (nEvent < 0 && GETNE_ON_OK == nEvent )
	{
		tr.name.strVal.TrimLeft();
		tr.name.strVal.TrimRight();

		if( tr.name.strVal.IsEmpty() )
				tr.save.nVal = 0;
		else if( tr.list.strVals.Find(tr.name.strVal) > -1 )
		{
			if( IDYES == MessageBox(getNContainer.GetSafeHwnd(), "Do you want to replace selected style?", "Save Style" , MB_YESNOCANCEL) )
				tr.save.nVal = 1;
			else
				tr.save.nVal = 0;
		}
		else
			tr.save.nVal = 1;

		return true;
	}

	return false;
}


#pragma labtalk(1) // Enable for LabTalk calling.


void HTMLTableDesignerApp_Run()
{
	if( s_pHTMLTableDesignerDlg == NULL )
	{
		s_pHTMLTableDesignerDlg = new HTMLTableDesignerDlg;
		if( s_pHTMLTableDesignerDlg )
			s_pHTMLTableDesignerDlg->Create(GetWindow());
	}
	else
	{
		s_pHTMLTableDesignerDlg->PostMessage(WM_SYSCOMMAND, SC_RESTORE);
		if( s_pHTMLTableDesignerDlg->IsRolledup() )
			s_pHTMLTableDesignerDlg->Rollup(false);

		SetActiveWindow(s_pHTMLTableDesignerDlg->GetSafeHwnd());

		FLASHWINFO st;
		st.cbSize = sizeof(st);
		st.hwnd = s_pHTMLTableDesignerDlg->GetSafeHwnd();
		st.dwFlags = FLASHW_CAPTION;
		st.uCount = 3;
		st.dwTimeout = 0;

		FlashWindowEx(&st);
	}
}
