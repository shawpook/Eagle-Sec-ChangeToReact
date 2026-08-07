const path = require('path');
const electron = require('electron');
const ipcRenderer = electron.ipcRenderer;
const appPath = path.normalize(app.getAppPath().replace("\\resources\\app.asar", ""));
const dllRoot = app.getAppPath().replace("\\resources\\app.asar", "");

let edge;

const EdgeJS = {
	hasInit: false,
	init: () => {
		if (EdgeJS.hasInit) return;
		EdgeJS.hasInit = true;
		function initEdgeScript (param1, param2, param3) {
			try {
				return edge.func(param1, param2, param3)
			}
			catch (err) {
				ipcRenderer.send('electron-log', err.stack || err);       
			}
		}


		let GhostScriptDir = path.normalize(`${process.env.PROGRAMFILES}/gs`);
        try {
            let p = path.normalize(GhostScriptDir + "/" + fs.readdirSync(`${process.env.PROGRAMFILES}/gs`)[0] + "/bin");
            if (fs.existsSync(p)) {
                EdgeJS.GHOST_SCRIPT_PATH = path.normalize(GhostScriptDir + "/" + fs.readdirSync(`${process.env.PROGRAMFILES}/gs`)[0] + "/bin");
                ipcRenderer.send('electron-info', `[bg] GhostScript: ${EdgeJS.GHOST_SCRIPT_PATH}`);
            }
        } catch (err) {            ipcRenderer.send('electron-info', `[bg] GhostScript: Not Found.`);
        }

        var forceDisableEdge = fs.existsSync(path.normalize(`${app.getPath('userData')}/DisableEdge`));
        if (forceDisableEdge) {
            ipcRenderer.send('electron-info', `[bg] Force disable Edge`);
            return;
        }

        ipcRenderer.send('electron-info', `[bg] Loading edge-cs module...`);

		// 备注，修改过 edge-cs.js 路径，不使用默认 edge-cs.dll 路径
        // return process.env.EDGE_CS_NATIVE || (process.env.EDGE_USE_CORECLR ? 'Edge.js.CSharp' : path.join(__dirname, 'edge-cs.dll'));
        // return `${process.env.ProgramData}/Eagle/edge-cs.dll`;
        try {
            var programDataPath = path.normalize(`${process.env.ProgramData}/Eagle`);
            if (!fs.existsSync(programDataPath)) {
                fs.mkdirSync(programDataPath);
            }
            var edgecsFile = path.normalize(programDataPath + "/edge-cs.dll");
            if (!fs.existsSync(edgecsFile)) {
                fse.copySync(`${dllRoot}/edge-cs.dll`, edgecsFile);
                ipcRenderer.send('electron-info', `[bg] Copy edge-cs.dll to ${edgecsFile}.`);
            }
        }
        catch (err) {
            ipcRenderer.send('electron-log', err.stack || err);
        }
        edge = require('electron-edge-js');
        ipcRenderer.send('electron-info', `[bg] edge-cs module loaded`);

		EdgeJS.RevealFilesInExplorer = initEdgeScript(function () {/*
			using System;
			using System.Threading.Tasks;
			using System.Collections.Generic;
			using System.IO;
			using System.Linq;
			using System.Runtime.CompilerServices;
			using System.Runtime.InteropServices;
			using System.Runtime.InteropServices.ComTypes;

			static class ShowSelectedInExplorer
			{
				[Flags]
				enum SHCONT : ushort
				{
					SHCONTF_CHECKING_FOR_CHILDREN = 0x0010,
					SHCONTF_FOLDERS = 0x0020,
					SHCONTF_NONFOLDERS = 0x0040,
					SHCONTF_INCLUDEHIDDEN = 0x0080,
					SHCONTF_INIT_ON_FIRST_NEXT = 0x0100,
					SHCONTF_NETPRINTERSRCH = 0x0200,
					SHCONTF_SHAREABLE = 0x0400,
					SHCONTF_STORAGE = 0x0800,
					SHCONTF_NAVIGATION_ENUM = 0x1000,
					SHCONTF_FASTITEMS = 0x2000,
					SHCONTF_FLATLIST = 0x4000,
					SHCONTF_ENABLE_ASYNC = 0x8000
				}

				[ComImport,
				Guid("000214E6-0000-0000-C000-000000000046"),
				InterfaceType(ComInterfaceType.InterfaceIsIUnknown),
				ComConversionLoss]
				interface IShellFolder
				{
					[MethodImpl(MethodImplOptions.InternalCall, MethodCodeType = MethodCodeType.Runtime)]
					void ParseDisplayName(IntPtr hwnd, [In, MarshalAs(UnmanagedType.Interface)] IBindCtx pbc, [In, MarshalAs(UnmanagedType.LPWStr)] string pszDisplayName, [Out] out uint pchEaten, [Out] out IntPtr ppidl, [In, Out] ref uint pdwAttributes);
					[PreserveSig]
					[MethodImpl(MethodImplOptions.InternalCall, MethodCodeType = MethodCodeType.Runtime)]
					int EnumObjects([In] IntPtr hwnd, [In] SHCONT grfFlags, [MarshalAs(UnmanagedType.Interface)] out IEnumIDList ppenumIDList);

					[PreserveSig]
					[MethodImpl(MethodImplOptions.InternalCall, MethodCodeType = MethodCodeType.Runtime)]
					int BindToObject([In] IntPtr pidl, [In, MarshalAs(UnmanagedType.Interface)] IBindCtx pbc, [In] ref Guid riid, [Out, MarshalAs(UnmanagedType.Interface)] out IShellFolder ppv);

					[MethodImpl(MethodImplOptions.InternalCall, MethodCodeType = MethodCodeType.Runtime)]
					void BindToStorage([In] ref IntPtr pidl, [In, MarshalAs(UnmanagedType.Interface)] IBindCtx pbc, [In] ref Guid riid, out IntPtr ppv);

					[MethodImpl(MethodImplOptions.InternalCall, MethodCodeType = MethodCodeType.Runtime)]
					void CompareIDs([In] IntPtr lParam, [In] ref IntPtr pidl1, [In] ref IntPtr pidl2);

					[MethodImpl(MethodImplOptions.InternalCall, MethodCodeType = MethodCodeType.Runtime)]
					void CreateViewObject([In] IntPtr hwndOwner, [In] ref Guid riid, out IntPtr ppv);

					[MethodImpl(MethodImplOptions.InternalCall, MethodCodeType = MethodCodeType.Runtime)]
					void GetAttributesOf([In] uint cidl, [In] IntPtr apidl, [In, Out] ref uint rgfInOut);


					[MethodImpl(MethodImplOptions.InternalCall, MethodCodeType = MethodCodeType.Runtime)]
					void GetUIObjectOf([In] IntPtr hwndOwner, [In] uint cidl, [In] IntPtr apidl, [In] ref Guid riid, [In, Out] ref uint rgfReserved, out IntPtr ppv);

					[MethodImpl(MethodImplOptions.InternalCall, MethodCodeType = MethodCodeType.Runtime)]
					void GetDisplayNameOf([In] ref IntPtr pidl, [In] uint uFlags, out IntPtr pName);

					[MethodImpl(MethodImplOptions.InternalCall, MethodCodeType = MethodCodeType.Runtime)]
					void SetNameOf([In] IntPtr hwnd, [In] ref IntPtr pidl, [In, MarshalAs(UnmanagedType.LPWStr)] string pszName, [In] uint uFlags, [Out] IntPtr ppidlOut);
				}

				[ComImport,
				Guid("000214F2-0000-0000-C000-000000000046"),
				InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
				interface IEnumIDList
				{
					[PreserveSig]
					[MethodImpl(MethodImplOptions.InternalCall, MethodCodeType = MethodCodeType.Runtime)]
					int Next(uint celt, IntPtr rgelt, out uint pceltFetched);

					[PreserveSig]
					[MethodImpl(MethodImplOptions.InternalCall, MethodCodeType = MethodCodeType.Runtime)]
					int Skip([In] uint celt);

					[PreserveSig]
					[MethodImpl(MethodImplOptions.InternalCall, MethodCodeType = MethodCodeType.Runtime)]
					int Reset();

					[PreserveSig]
					[MethodImpl(MethodImplOptions.InternalCall, MethodCodeType = MethodCodeType.Runtime)]
					int Clone([MarshalAs(UnmanagedType.Interface)] out IEnumIDList ppenum);
				}

				static class NativeMethods
				{
					[DllImport("shell32.dll", EntryPoint = "SHGetDesktopFolder", CharSet = CharSet.Unicode,
						SetLastError = true)]
					static extern int SHGetDesktopFolder_([MarshalAs(UnmanagedType.Interface)] out IShellFolder ppshf);

					public static IShellFolder SHGetDesktopFolder()
					{
						IShellFolder result;
						Marshal.ThrowExceptionForHR(SHGetDesktopFolder_(out result));
						return result;
					}

					[DllImport("shell32.dll", EntryPoint = "SHOpenFolderAndSelectItems")]
					static extern int SHOpenFolderAndSelectItems_(
						[In] IntPtr pidlFolder, uint cidl, [In, Optional, MarshalAs(UnmanagedType.LPArray)] IntPtr[] apidl,
						int dwFlags);

					public static void SHOpenFolderAndSelectItems(IntPtr pidlFolder, IntPtr[] apidl, int dwFlags)
					{
						var cidl = (apidl != null) ? (uint)apidl.Length : 0U;
						var result = SHOpenFolderAndSelectItems_(pidlFolder, cidl, apidl, dwFlags);
						Marshal.ThrowExceptionForHR(result);
					}

					[DllImport("shell32.dll")]
					public static extern void ILFree([In] IntPtr pidl);
				}

				static IntPtr GetShellFolderChildrenRelativePIDL(IShellFolder parentFolder, string displayName)
				{
					uint pchEaten;
					uint pdwAttributes = 0;
					IntPtr ppidl;
					parentFolder.ParseDisplayName(IntPtr.Zero, null, displayName, out pchEaten, out ppidl, ref pdwAttributes);

					return ppidl;
				}

				static IntPtr PathToAbsolutePIDL(string path)
				{
					var desktopFolder = NativeMethods.SHGetDesktopFolder();
					return GetShellFolderChildrenRelativePIDL(desktopFolder, path);
				}

				static Guid IID_IShellFolder = typeof(IShellFolder).GUID;

				static IShellFolder PIDLToShellFolder(IShellFolder parent, IntPtr pidl)
				{
					IShellFolder folder;
					var result = parent.BindToObject(pidl, null, ref IID_IShellFolder, out folder);
					Marshal.ThrowExceptionForHR((int)result);
					return folder;
				}

				static IShellFolder PIDLToShellFolder(IntPtr pidl)
				{
					return PIDLToShellFolder(NativeMethods.SHGetDesktopFolder(), pidl);
				}

				static void SHOpenFolderAndSelectItems(IntPtr pidlFolder, IntPtr[] apidl, bool edit)
				{
					NativeMethods.SHOpenFolderAndSelectItems(pidlFolder, apidl, edit ? 1 : 0);
				}

				public static void FileOrFolder(string path, bool edit = false)
				{
					if (path == null) throw new ArgumentNullException("path");

					var pidl = PathToAbsolutePIDL(path);
					try
					{
						SHOpenFolderAndSelectItems(pidl, null, edit);
					}
					finally
					{
						NativeMethods.ILFree(pidl);
					}
				}

				static IEnumerable<FileSystemInfo> PathToFileSystemInfo(IEnumerable<string> paths)
				{
					foreach (var path in paths)
					{
						var fixedPath = path;
						if (fixedPath.EndsWith(Path.DirectorySeparatorChar.ToString())
							|| fixedPath.EndsWith(Path.AltDirectorySeparatorChar.ToString()))
						{
							fixedPath = fixedPath.Remove(fixedPath.Length - 1);
						}

						if (Directory.Exists(fixedPath))
						{
							yield return new DirectoryInfo(fixedPath);
						}
						else if (File.Exists(fixedPath))
						{
							yield return new FileInfo(fixedPath);
						}
						else
						{
							throw new FileNotFoundException
								(string.Format("The specified file or folder doesn't exists : {0}", fixedPath),
								fixedPath);
						}
					}
				}

				public static void FilesOrFolders(string parentDirectory, ICollection<string> filenames)
				{
					if (filenames == null) throw new ArgumentNullException("filenames");
					if (filenames.Count == 0) return;

					var parentPidl = PathToAbsolutePIDL(parentDirectory);
					try
					{
						var parent = PIDLToShellFolder(parentPidl);
						var filesPidl = filenames
							.Select(filename => GetShellFolderChildrenRelativePIDL(parent, filename))
							.ToArray();

						try
						{
							SHOpenFolderAndSelectItems(parentPidl, filesPidl, false);
						}
						finally
						{
							foreach (var pidl in filesPidl)
							{
								NativeMethods.ILFree(pidl);
							}
						}
					}
					finally
					{
						NativeMethods.ILFree(parentPidl);
					}
				}

				public static void FilesOrFolders(params string[] paths)
				{
					FilesOrFolders((IEnumerable<string>)paths);
				}

				public static void FilesOrFolders(IEnumerable<string> paths)
				{
					if (paths == null) throw new ArgumentNullException("paths");

					FilesOrFolders(PathToFileSystemInfo(paths));
				}

				public static void FilesOrFolders(IEnumerable<FileSystemInfo> paths)
				{
					if (paths == null) throw new ArgumentNullException("paths");
					var pathsArray = paths.ToArray();
					if (pathsArray.Count() == 0) return;

					var explorerWindows = pathsArray.GroupBy(p => Path.GetDirectoryName(p.FullName));

					foreach (var explorerWindowPaths in explorerWindows)
					{
						var parentDirectory = Path.GetDirectoryName(explorerWindowPaths.First().FullName);
						FilesOrFolders(parentDirectory, explorerWindowPaths.Select(fsi => fsi.Name).ToList());
					}
				}
			}

			public class Startup
			{
				public async Task<object> Invoke(object[] list)
				{
					//string[] input = System.Array.ConvertAll((object[])list, x => x.ToString());
					List<string> paths = new List<string>();
					for (int i = 0; i < list.Length; i++) {
						paths.Add((string)list[i]);
					}
					try {
						// ShowSelectedInExplorer.FilesOrFolders(@"C:\Program Files (x86)", @"C:\Projects");
						ShowSelectedInExplorer.FilesOrFolders(paths);
						return null;
					}
					catch {
						return null;
					}
				}
			}

		*/});

		var excelcode = function () {/*
			#r "System.Windows.Forms.dll"
			#r "System.Collections.dll"
			#r "mscorlib.dll"
			#r "System.Drawing.dll"
			
			using System;
			using System.Windows.Forms;
			using System.Collections.Specialized;
			using System.Collections.Generic;
			using System.Threading.Tasks;
			using System.Reflection;
			using System.Diagnostics;
			using System.IO;
			using System.Drawing;
			using Microsoft.Office.Interop;
			using Excel = Microsoft.Office.Interop.Excel;

			public class Startup
			{
				public async Task<object> Invoke(object[] paths)
				{
					string filePath = (string)paths[0];
					string outPutPath = (string)paths[1];
					var app = new Excel.Application();
					var objMis = Type.Missing;
					var singleExcel = app.Workbooks.Open(filePath, objMis, objMis, objMis, objMis, objMis, objMis, objMis, objMis, objMis, objMis, objMis, objMis, objMis, objMis);
					
					try
					{
						singleExcel.ExportAsFixedFormat(Microsoft.Office.Interop.Excel.XlFixedFormatType.xlTypePDF, outPutPath, objMis, objMis, objMis, 1, 1, objMis, objMis);
						singleExcel.Close(objMis, objMis, objMis);
						//app.Quit();
						return "success";

					}
					catch (Exception Excel)
					{
						singleExcel.Close(objMis, objMis, objMis);
						//app.Quit();
						throw Excel;
						return null;
					}
				}
			}
		*/};
		EdgeJS.generateExcelThumbnail = initEdgeScript({
			source: excelcode,
			references: [ dllRoot + '\\libOffice.dll', dllRoot + '\\libExcel.dll' ]
		});

		var pptcode = function () {/*

			#r "System.Windows.Forms.dll"
			#r "System.Collections.dll"
			#r "mscorlib.dll"
			
			using System;
			using System.Windows.Forms;
			using System.Collections.Specialized;
			using System.Collections.Generic;
			using System.Threading.Tasks;
			using System.Reflection;
			using System.Diagnostics;
			using System.IO;

			public class Startup
			{
				public async Task<object> Invoke(object[] paths)
				{
					try {
						var app = new Microsoft.Office.Interop.PowerPoint.Application();
						var ppt = app.Presentations.Open((string)paths[0], Microsoft.Office.Core.MsoTriState.msoTrue, Microsoft.Office.Core.MsoTriState.msoFalse, Microsoft.Office.Core.MsoTriState.msoFalse);
						var index = 0;
						var fileName = Path.GetFileNameWithoutExtension((string)paths[0]);
						foreach (Microsoft.Office.Interop.PowerPoint.Slide slid in ppt.Slides)
						{
							++index;
							//设置图片大小
							slid.Export((string)paths[1], "png");
							break;
						}

						//释放资源
						ppt.Close();
						// 檢查是否所有PPT文件都關閉了，如果還有其他文件，那就不 quit
						if (app.Presentations.Count == 0) {
							app.Quit();
						}
						return "success";
					}
					catch (Exception exception) {
						throw exception;
						return null;
					}
				}
			}

		*/};

		EdgeJS.generatePPTXThumbnail = initEdgeScript({
			source: pptcode,
			references: [ dllRoot + '\\libOffice.dll', dllRoot + '\\libPPT.dll' ]
		});

		EdgeJS.openAppDialog = initEdgeScript(function () {/*

			#r "System.Windows.Forms.dll"
			#r "System.Collections.dll"
			#r "mscorlib.dll"

			using System.Windows.Forms;
			using System.Collections.Specialized;
			using System.Collections.Generic;
			using System.Threading.Tasks;
			using System.Diagnostics;

			public class Startup
			{
				public async Task<object> Invoke(string path)
				{
					Process proc = new Process();
					proc.EnableRaisingEvents = false;
					proc.StartInfo.FileName = "rundll32.exe";
					proc.StartInfo.Arguments = "shell32,OpenAs_RunDLL " + path;
					proc.Start();
					return path;
				}
			}
		*/});

		EdgeJS.ImageSize = initEdgeScript(function () {/*

            #r "System.Drawing.dll"
            using System.Threading.Tasks;
            using System.IO;
            using System.Drawing;
            public class Startup
            {
                public async Task<object> Invoke(object[] list)
                {
                    string input = (string)list[0];
                    try {
                        Stream stream = File.OpenRead(input);
                        Image sourceImage = Image.FromStream(stream, false, false);
                        if (sourceImage != null) {
                            int[] size = new int[2];
                            size[0] = sourceImage.Width;
                            size[1] = sourceImage.Height;
                            return size;
                        }
                        else {
                            return null;
                        }
                    }
                    catch {
                        return null;
                    }
                }
            }
        */});

		EdgeJS.BitmapSize = initEdgeScript({
			source: function () {/*
				#r "System.Xaml.dll"
				using System.Threading.Tasks;
				using System.IO;
				using System.Windows.Media.Imaging ;
				using System;
				public class Startup
				{
					public async Task<object> Invoke(object[] list)
					{
						string input = (string)list[0];
						try {
							var decoder = BitmapDecoder.Create(new Uri(input), BitmapCreateOptions.None, BitmapCacheOption.Default);
							var frame = decoder.Frames[0];
							int[] size = new int[2];
							size[0] = frame.PixelWidth;
							size[1] = frame.PixelHeight;
							return size;
						}
						catch {
							return null;
						}
					}
				}
			*/},
			references: [ dllRoot + '\\WindowsBase.dll', dllRoot + '\\PresentationCore.dll']
		});

		EdgeJS.Heic2File = initEdgeScript({
			source: function () {/*
				#r "System.Xaml.dll"
				using System.Threading.Tasks;
				using System.IO;
				using System.Windows.Media.Imaging ;
				using System;
				public class Startup
				{
					public async Task<object> Invoke(object[] list)
					{
						string input = (string)list[0];
						try {
                            int[] size = new int[2];
                            using (var fileStream  = new FileStream(input, FileMode.Open, FileAccess.Read, FileShare.Read))
							{
                                var decoder = BitmapDecoder.Create(fileStream, BitmapCreateOptions.PreservePixelFormat, BitmapCacheOption.Default);
                                var frame = decoder.Frames[0];
                                
                                size[0] = frame.PixelWidth;
                                size[1] = frame.PixelHeight;

                                var encoder = new JpegBitmapEncoder();
                                encoder.Frames.Add(BitmapFrame.Create(frame));
                                using (var stream = new FileStream((string)list[1], FileMode.Create))
                                {
                                    encoder.Save(stream);
                                }
							}
							return size;
						}
						catch (Exception ex) {
							// return ex.Message;
                            return null;
						}
					}
				}
			*/},
			references: [ dllRoot + '\\WindowsBase.dll', dllRoot + '\\PresentationCore.dll']
		});

		var magickcode = function () {/*
            #r "System.Drawing.dll"
            using System.Drawing;
            using System.Threading.Tasks;
            using ImageMagick;
            using System;
            using System.IO;

            public class Startup
            {
                public async Task<object> Invoke(object[] list)
                {
                    try {
                        OpenCL.IsEnabled = false;
                        try {
                            if (list[4] != null) {
                                MagickNET.SetGhostscriptDirectory((string)list[4]);
                            }
                        }
                        catch (Exception exception) {}

                        MagickNET.SetTempDirectory(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData));
                        using (MagickImage image = new MagickImage((string)list[0])) {
                            if (image != null && image.Width > 0) {

                                // image.SetProfile(ColorProfile.SRGB);
                                image.TransformColorSpace(ColorProfile.USWebCoatedSWOP, ColorProfile.SRGB);

                                image.Strip();

                                int[] size = new int[2];
                                size[0] = image.Width;
                                size[1] = image.Height;
                                //if (list[2].Equals("jpg")) {
                                //    image.Format = MagickFormat.Jpeg;
                                //    image.Quality = 100;
                                //}
                                //else {
                                    image.Format = MagickFormat.Png;
                                //}
                                if (image.Width > (int)list[3]) {
                                    if ((int)list[3] > 1280) {
                                        image.Thumbnail((int)list[3], (int)list[3]);
                                    }
                                    else {
                                        image.Resize((int)list[3], 0);
                                    }
                                }

                                image.Write((string)list[1]);
                                return size;
                            }
                            else {
                                return null;
                            }
                        }
                    }
                    catch (MagickException exception) {
                        throw exception;
                        return null;
                    }

                }
            }
        */};

        EdgeJS.Magick = initEdgeScript({
            source: magickcode,
            // references: [ dllRoot + '\\Magick.dll' ]
            references: [ dllRoot + '\\Magick.Core.dll', dllRoot + '\\Magick.dll' ]
        });

		EdgeJS.activateFontWithEdge = initEdgeScript(function () {/*

			#r "System.Drawing.dll"
			using System.Threading.Tasks;
			using System;
			using System.Collections.Generic;
			using System.ComponentModel;
			using System.Windows.Forms;
			using System.IO;
			using System.Text;
			using System.Drawing.Text;
			using System.Runtime.InteropServices;
			using Microsoft.Win32;

			public class Startup
			{
				[DllImport("user32.dll")]
				public static extern int PostMessage(int hWnd, // handle to destination window 
				uint Msg, // message 
				int wParam, // first message parameter 
				int lParam // second message parameter 
				);

				[DllImport("gdi32", EntryPoint = "AddFontResource")]
				public static extern int AddFontResourceA(string lpFileName);
				[System.Runtime.InteropServices.DllImport("gdi32.dll")]
				private static extern int AddFontResource(string lpszFilename);
				[System.Runtime.InteropServices.DllImport("gdi32.dll")]
				private static extern int CreateScalableFontResource(uint fdwHidden, string
					lpszFontRes, string lpszFontFile, string lpszCurrentPath);

				public async Task<object> Invoke(dynamic input)
				{
					string fontName = (string)input;
					const int WM_FONTCHANGE = 0x001D;
					const int HWND_BROADCAST = 0xffff;

					// Creates the full path where your font will be installed
					var fontDestination = Path.Combine(System.Environment.GetFolderPath(System.Environment.SpecialFolder.Fonts), fontName);

					// Retrieves font name
					// Makes sure you reference System.Drawing
					PrivateFontCollection fontCol = new PrivateFontCollection();
					fontCol.AddFontFile(fontDestination);
					var actualFontName = fontCol.Families[0].Name;

					//Add font
					AddFontResource(fontDestination);
					PostMessage(HWND_BROADCAST, WM_FONTCHANGE, 0, 0);

					return actualFontName;
				}
			}
		*/});

		EdgeJS.deactivateFontWithEdge = initEdgeScript(function () {/*
        
			#r "System.Drawing.dll"
			using System.Threading.Tasks;
			using System;
			using System.IO;
			using System.Text;
			using System.Drawing.Text;
			using System.Runtime.InteropServices;
			using Microsoft.Win32;

			public class Startup
			{

				[DllImport("user32.dll")]
				public static extern int PostMessage(int hWnd, // handle to destination window 
				uint Msg, // message 
				int wParam, // first message parameter 
				int lParam // second message parameter 
				);

				[DllImport("gdi32", EntryPoint = "RemoveFontResource")]
				public static extern int RemoveFontResourceA(string lpFileName);
				[System.Runtime.InteropServices.DllImport("gdi32.dll")]
				private static extern int RemoveFontResource(string lpszFilename);
				[System.Runtime.InteropServices.DllImport("gdi32.dll")]
				private static extern int CreateScalableFontResource(uint fdwHidden, string
					lpszFontRes, string lpszFontFile, string lpszCurrentPath);

				public async Task<object> Invoke(dynamic input)
				{
					string fontName = (string)input;
					const int WM_FONTCHANGE = 0x001D;
					const int HWND_BROADCAST = 0xffff;

					// Creates the full path where your font will be installed
					var fontDestination = Path.Combine(System.Environment.GetFolderPath(System.Environment.SpecialFolder.Fonts), fontName);

					// Retrieves font name
					// Makes sure you reference System.Drawing
					//PrivateFontCollection fontCol = new PrivateFontCollection();
					//fontCol.AddFontFile(fontDestination);
					//var actualFontName = fontCol.Families[0].Name;

					//Add font
					RemoveFontResource(fontDestination);
					PostMessage(HWND_BROADCAST, WM_FONTCHANGE, 0, 0);
					return 1;
				}
			}
		*/});

		ipcRenderer.on('EdgeJS.Heic2File', async (event, params) => {
			return new Promise(async (resolve, reject) => {
				if (!EdgeJS.hasInit) {
					console.time("initEdge");
					EdgeJS.init();
					console.timeEnd("initEdge");
				}
				let id = params.id;
				let src = params.src;
				let dest = params.dest;
				EdgeJS.Heic2File([src, dest], function (err, result) {
					ipcRenderer.send(`EdgeJS.Heic2File-${id}`, result);
				});
			});
		});

		console.log(dllRoot + '\\Magick.dll');

		ipcRenderer.send('edge-script-loaded');
        ipcRenderer.send('electron-info', `[bg] edge-cs script loaded successfully`);
	}
}

module.exports = EdgeJS;